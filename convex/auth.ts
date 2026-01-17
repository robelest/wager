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

// Fetch user's Discord guilds using their OAuth access token
export const getMyDiscordGuilds = action({
  args: {},
  handler: async (ctx): Promise<Array<{ id: string; name: string; icon: string | null }>> => {
    const auth = createAuth(ctx);

    // Get the authenticated user
    const authUser = await authComponent.getAuthUser(ctx as any);
    if (!authUser) {
      return [];
    }

    try {
      // Get the Discord access token
      const tokenResult = await auth.api.getAccessToken({
        body: {
          providerId: "discord",
          userId: authUser._id,
        },
      });

      if (!tokenResult?.accessToken) {
        console.error("No Discord access token found");
        return [];
      }

      // Fetch user's guilds from Discord API
      const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch Discord guilds:", await response.text());
        return [];
      }

      const guilds = await response.json();
      return guilds.map((g: any) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
      }));
    } catch (error) {
      console.error("Error fetching Discord guilds:", error);
      return [];
    }
  },
});
