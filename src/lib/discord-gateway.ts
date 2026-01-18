/**
 * Discord Gateway Client - Real-time sync with Convex
 *
 * This module initializes a discord.js client that connects to Discord's Gateway
 * to receive real-time events (guild joins/leaves) that webhooks can't detect.
 *
 * Called from src/server.ts when the TanStack Start server boots.
 */

import { Client, Events, GatewayIntentBits } from "discord.js";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

let client: Client | null = null;

export function startDiscordGateway() {
  // Only run on server, only once
  if (client || typeof window !== "undefined") return;

  const token = process.env.DISCORD_BOT_TOKEN;
  const convexUrl = process.env.PUBLIC_CONVEX_URL;

  if (!token || !convexUrl) {
    console.warn("[Discord Gateway] Missing DISCORD_BOT_TOKEN or PUBLIC_CONVEX_URL - skipping");
    return;
  }

  console.log("[Discord Gateway] Initializing...");

  client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const convex = new ConvexHttpClient(convexUrl);

  // Bot connected - sync all guilds
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`[Discord Gateway] Ready as ${readyClient.user.tag}`);
    console.log(`[Discord Gateway] Connected to ${readyClient.guilds.cache.size} servers`);

    // Sync all current guilds to Convex
    for (const [guildId, guild] of readyClient.guilds.cache) {
      try {
        await convex.mutation(api.discord.syncServer, {
          guildId,
          guildName: guild.name,
          isActive: true,
        });
      } catch (error) {
        console.error(`[Discord Gateway] Failed to sync ${guild.name}:`, error);
      }
    }
    console.log("[Discord Gateway] Initial sync complete");
  });

  // Bot added to server
  client.on(Events.GuildCreate, async (guild) => {
    console.log(`[Discord Gateway] Joined server: ${guild.name} (${guild.id})`);
    try {
      await convex.mutation(api.discord.syncServer, {
        guildId: guild.id,
        guildName: guild.name,
        isActive: true,
      });
    } catch (error) {
      console.error(`[Discord Gateway] Failed to sync join:`, error);
    }
  });

  // Bot removed from server (kicked/banned/server deleted)
  client.on(Events.GuildDelete, async (guild) => {
    const serverName = guild.name || "Unknown Server";
    console.log(`[Discord Gateway] Left server: ${serverName} (${guild.id})`);
    try {
      await convex.mutation(api.discord.syncServer, {
        guildId: guild.id,
        guildName: serverName,
        isActive: false,
      });
    } catch (error) {
      console.error(`[Discord Gateway] Failed to sync leave:`, error);
    }
  });

  // Server name/settings changed
  client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
    if (oldGuild.name !== newGuild.name) {
      console.log(`[Discord Gateway] Server renamed: ${oldGuild.name} -> ${newGuild.name}`);
      try {
        await convex.mutation(api.discord.syncServer, {
          guildId: newGuild.id,
          guildName: newGuild.name,
          isActive: true,
        });
      } catch (error) {
        console.error(`[Discord Gateway] Failed to sync rename:`, error);
      }
    }
  });

  // Error handling
  client.on(Events.Error, (error) => {
    console.error("[Discord Gateway] Client error:", error);
  });

  // Login to Discord
  client.login(token).catch((error) => {
    console.error("[Discord Gateway] Failed to login:", error);
    client = null;
  });
}

// Export for potential cleanup/testing
export function getDiscordClient() {
  return client;
}
