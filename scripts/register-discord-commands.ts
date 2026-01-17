/**
 * Register Discord slash commands
 *
 * Run this script once to register commands with Discord:
 * bun run scripts/register-discord-commands.ts
 *
 * Required env vars:
 * - DISCORD_CLIENT_ID
 * - DISCORD_BOT_TOKEN (you'll need to create a bot and get its token)
 */

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!DISCORD_CLIENT_ID || !DISCORD_BOT_TOKEN) {
  console.error("Missing DISCORD_CLIENT_ID or DISCORD_BOT_TOKEN");
  process.exit(1);
}

const commands = [
  {
    name: "wager",
    description: "Create a new public accountability wager",
    options: [
      {
        name: "task",
        description: "What do you commit to doing?",
        type: 3, // STRING
        required: true,
        max_length: 200,
      },
      {
        name: "consequence",
        description: "What happens if you fail?",
        type: 3, // STRING
        required: true,
        max_length: 200,
      },
      {
        name: "hours",
        description: "Hours until deadline (default: 24)",
        type: 4, // INTEGER
        required: false,
        min_value: 1,
        max_value: 168,
      },
    ],
  },
  {
    name: "proof",
    description: "Submit proof for your active wager",
    options: [
      {
        name: "image",
        description: "Image proof of completion",
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
    description: "Configure Wager bot channels (admin only)",
    default_member_permissions: "8", // ADMINISTRATOR
    options: [
      {
        name: "wagers",
        description: "Channel for wager announcements",
        type: 7, // CHANNEL
        required: false,
        channel_types: [0], // GUILD_TEXT
      },
      {
        name: "proof",
        description: "Channel for proof submissions",
        type: 7, // CHANNEL
        required: false,
        channel_types: [0], // GUILD_TEXT
      },
      {
        name: "results",
        description: "Channel for result announcements",
        type: 7, // CHANNEL
        required: false,
        channel_types: [0], // GUILD_TEXT
      },
    ],
  },
];

async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${DISCORD_CLIENT_ID}/commands`;

  console.log("Registering slash commands...");
  console.log(`URL: ${url}`);
  console.log(`Commands: ${commands.map((c) => c.name).join(", ")}`);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to register commands:", error);
    process.exit(1);
  }

  const result = await response.json();
  console.log("Commands registered successfully!");
  console.log(
    "Registered:",
    result.map((c: any) => `/${c.name}`).join(", ")
  );
}

registerCommands().catch(console.error);
