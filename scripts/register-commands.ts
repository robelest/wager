/**
 * Script to register Discord slash commands
 * Run with: bun scripts/register-commands.ts
 *
 * Required environment variables:
 * - DISCORD_BOT_TOKEN
 * - DISCORD_APP_ID
 */

import { REST, Routes } from "@discordjs/rest";

const commands = [
  {
    name: "wager",
    description: "Create a public wager with accountability",
    options: [
      {
        name: "task",
        description: "What you commit to doing",
        type: 3, // STRING
        required: true,
      },
      {
        name: "consequence",
        description: "What happens if you fail",
        type: 3, // STRING
        required: true,
      },
      {
        name: "hours",
        description: "Hours until deadline (default: 24)",
        type: 4, // INTEGER
        required: false,
        min_value: 1,
        max_value: 168, // 1 week
      },
    ],
  },
  {
    name: "proof",
    description: "Submit proof for your active wager",
    options: [
      {
        name: "image",
        description: "Upload an image as proof",
        type: 11, // ATTACHMENT
        required: true,
      },
    ],
  },
  {
    name: "mywagers",
    description: "View your active wagers",
  },
  {
    name: "leaderboard",
    description: "View the server leaderboard",
  },
  {
    name: "setup",
    description: "Configure the bot for this server (admin only)",
    default_member_permissions: "8", // ADMINISTRATOR
    options: [
      {
        name: "wagers",
        description: "Channel for wager announcements",
        type: 7, // CHANNEL
        required: false,
      },
      {
        name: "proof",
        description: "Channel for proof submissions",
        type: 7, // CHANNEL
        required: false,
      },
      {
        name: "results",
        description: "Channel for result announcements",
        type: 7, // CHANNEL
        required: false,
      },
    ],
  },
  {
    name: "reward",
    description: "Award or deduct points from a user (admin only)",
    default_member_permissions: "8", // ADMINISTRATOR
    options: [
      {
        name: "user",
        description: "The user to reward",
        type: 6, // USER
        required: true,
      },
      {
        name: "amount",
        description: "Points to award (positive) or deduct (negative)",
        type: 4, // INTEGER
        required: true,
        min_value: -1000,
        max_value: 1000,
      },
      {
        name: "reason",
        description: "Reason for the reward",
        type: 3, // STRING
        required: false,
      },
    ],
  },
];

async function registerCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_APP_ID;

  if (!token || !appId) {
    console.error("Missing DISCORD_BOT_TOKEN or DISCORD_APP_ID environment variables");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("Registering slash commands...");

    // Register globally (takes up to 1 hour to propagate)
    await rest.put(Routes.applicationCommands(appId), { body: commands });

    console.log("Successfully registered commands:");
    commands.forEach((cmd) => console.log(`  /${cmd.name}`));
  } catch (error) {
    console.error("Error registering commands:", error);
    process.exit(1);
  }
}

registerCommands();
