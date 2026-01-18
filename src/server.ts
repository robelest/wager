/**
 * TanStack Start Server Entry Point
 *
 * This file initializes the server and starts background services
 * like the Discord Gateway client for real-time sync.
 */

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { startDiscordGateway } from "./lib/discord-gateway";

// Start Discord Gateway when server boots (only on VPS, not during build)
if (process.env.NODE_ENV === "production" || process.env.DISCORD_BOT_TOKEN) {
  startDiscordGateway();
}

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
