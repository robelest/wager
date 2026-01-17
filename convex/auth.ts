import { betterAuth } from "better-auth";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { query, action } from "./_generated/server";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

// Create the Better Auth Convex client with proper types
export const authComponent = createClient<DataModel>(components.betterAuth);

// Create the Better Auth instance with Discord OAuth
export const createAuth = (ctx: any) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: false, // Discord-only auth
    },
    socialProviders: {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        scope: ["identify", "guilds"], // Request guilds scope for server discovery
        prompt: "consent", // Force consent screen to ensure refresh token is issued
      },
    },
    plugins: [convex({ authConfig })],
  });
};

// Query to get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // Type cast needed due to Better Auth's generic context type
    return await authComponent.getAuthUser(ctx as any);
  },
});

// Get Discord access token for the current user (for client-side Discord API calls)
export const getDiscordAccessToken = action({
  args: {},
  handler: async (ctx): Promise<{ accessToken: string | null; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { accessToken: null, error: "Not authenticated" };
    }

    // Query Better Auth's account table directly
    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "providerId", operator: "eq", value: "discord" },
        { field: "userId", operator: "eq", value: identity.subject },
      ],
    });

    if (!account) {
      return { accessToken: null, error: "No Discord account found" };
    }

    return {
      accessToken: account.accessToken || null,
      error: account.accessToken ? undefined : "Token not stored",
    };
  },
});

