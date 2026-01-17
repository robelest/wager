import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { discordWebhook } from "./discord";

const http = httpRouter();

// Register Better Auth routes with CORS enabled for OAuth callbacks
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [
      "http://localhost:3000",
      process.env.SITE_URL || "http://localhost:3000",
    ],
  },
});

// Discord interactions webhook
// Set this URL in Discord Developer Portal: https://your-deployment.convex.site/discord
http.route({
  path: "/discord",
  method: "POST",
  handler: discordWebhook,
});

export default http;
