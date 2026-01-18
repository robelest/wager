import { httpAction, mutation, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import nacl from "tweetnacl";
import { internal, api } from "./_generated/api";
import { getWagerTask, getWagerDeadline } from "./validators";
import {
  createWagerEmbed,
  createResultEmbed,
  createProofEmbed,
  createLeaderboardEmbed,
  createMyWagersEmbed,
  createBetConfirmationEmbed,
} from "./discord/embeds";
import {
  createBettingButtons,
  parseCustomId,
} from "./discord/components";

// ═══════════════════════════════════════════════════════════════
// Discord Interaction Types
// ═══════════════════════════════════════════════════════════════
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
} as const;

// ═══════════════════════════════════════════════════════════════
// Signature Verification
// ═══════════════════════════════════════════════════════════════
function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  try {
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      hexToUint8Array(signature),
      hexToUint8Array(publicKey)
    );
    return isValid;
  } catch {
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Clean up error messages for user display
function cleanErrorMessage(error: any): string {
  let message = error?.message || error?.toString() || "Something went wrong";

  // Strip common prefixes
  message = message.replace(/^(Uncaught )?Error:\s*/i, "");

  // Remove stack traces (anything after newline)
  message = message.split("\n")[0];

  // Trim whitespace
  return message.trim();
}

// Fetch guild name from Discord API
async function fetchGuildNameFromDiscord(guildId: string): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return null;

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!response.ok) return null;

    const guild = await response.json();
    return guild.name || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Main Discord Webhook Handler
// ═══════════════════════════════════════════════════════════════
export const discordWebhook = httpAction(async (ctx, request) => {
  const publicKey = process.env.DISCORD_PUBLIC_KEY!;

  // Get headers for verification
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const body = await request.text();

  // Verify the request
  if (!signature || !timestamp) {
    return new Response("Missing signature", { status: 401 });
  }

  if (!verifyDiscordSignature(publicKey, signature, timestamp, body)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(body);

  // Handle PING (Discord endpoint verification)
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  // Handle slash commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return await handleSlashCommand(ctx, interaction);
  }

  // Handle button clicks
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    return await handleButtonClick(ctx, interaction);
  }

  return Response.json({ type: InteractionResponseType.PONG });
});

// ═══════════════════════════════════════════════════════════════
// Slash Command Handler
// ═══════════════════════════════════════════════════════════════
async function handleSlashCommand(ctx: any, interaction: any) {
  const { name, options } = interaction.data;
  const user = interaction.member?.user || interaction.user;
  const guildId = interaction.guild_id;

  // Discord HTTP interactions don't include guild.name, only guild_id
  // We need to either get it from our DB or fetch it from Discord API
  let guildName = interaction.guild?.name;

  if (guildId && !guildName) {
    // First check our database for existing server record
    const existingServer = await ctx.runQuery(api.discord.getServerByGuildId, { guildId });

    if (existingServer && existingServer.guildName !== "Unknown Server") {
      guildName = existingServer.guildName;
    } else {
      // Fetch from Discord API if we don't have a real name
      guildName = await fetchGuildNameFromDiscord(guildId);
    }
  }

  // Auto-register server with the resolved name
  if (guildId) {
    await ctx.runMutation(api.discord.registerServer, {
      guildId,
      guildName: guildName || "Unknown Server",
    });
  }

  switch (name) {
    case "wager":
      return await handleWagerCommand(ctx, interaction, user, guildId, options);

    case "proof":
      return await handleProofCommand(ctx, interaction, user, guildId, options);

    case "mywagers":
      return await handleMyWagersCommand(ctx, user);

    case "leaderboard":
      return await handleLeaderboardCommand(ctx, guildId);

    case "setup":
      return await handleSetupCommand(ctx, interaction, guildId, options);

    case "reward":
      return await handleRewardCommand(ctx, interaction, user, guildId, options);

    default:
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "Unknown command", flags: 64 },
      });
  }
}

// ═══════════════════════════════════════════════════════════════
// Individual Command Handlers
// ═══════════════════════════════════════════════════════════════
async function handleWagerCommand(
  ctx: any,
  _interaction: any, // May be used in the future for modal responses
  user: any,
  guildId: string,
  options: any[]
) {
  const task = options?.find((o: any) => o.name === "task")?.value;
  const consequence = options?.find((o: any) => o.name === "consequence")?.value;
  const hours = options?.find((o: any) => o.name === "hours")?.value || 24;

  if (!task || !consequence) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Missing task or consequence", flags: 64 },
    });
  }

  try {
    // Create wager in database
    const result = await ctx.runMutation(api.wagers.createWagerFromDiscord, {
      discordId: user.id,
      discordUsername: user.username,
      discordDisplayName: user.global_name || user.username,
      discordAvatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
      guildId,
      task,
      consequence,
      deadlineHours: hours,
    });

    const deadline = Date.now() + hours * 60 * 60 * 1000;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : null;

    const embed = createWagerEmbed(
      user.global_name || user.username,
      avatarUrl,
      task,
      consequence,
      deadline,
      result.wagerId
    );

    // Enhanced betting buttons with amount selector
    const components = createBettingButtons(result.wagerId);

    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [embed],
        components,
      },
    });
  } catch (error) {
    console.error("Error creating wager:", error);
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Failed to create wager. Please try again.", flags: 64 },
    });
  }
}

async function handleProofCommand(
  ctx: any,
  interaction: any,
  user: any,
  guildId: string,
  options: any[]
) {
  // Get the attachment from resolved data
  const attachmentId = options?.find((o: any) => o.name === "image")?.value;
  const attachment = interaction.data.resolved?.attachments?.[attachmentId];

  if (!attachment || !attachment.content_type?.startsWith("image/")) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Please provide a valid image file.", flags: 64 },
    });
  }

  try {
    const result = await ctx.runMutation(api.wagers.submitProofFromDiscord, {
      discordId: user.id,
      imageUrl: attachment.url,
      messageId: interaction.id,
      guildId,
    });

    if (!result.success) {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: result.message || "No active wager found.",
          flags: 64,
        },
      });
    }

    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `Proof submitted for "${result.task}"! Verifying...`,
      },
    });
  } catch (error) {
    console.error("Error submitting proof:", error);
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Failed to submit proof.", flags: 64 },
    });
  }
}

async function handleMyWagersCommand(ctx: any, user: any) {
  try {
    const wagers = await ctx.runQuery(api.wagers.getUserActiveWagers, {
      discordId: user.id,
    });

    // Use the new embed helper
    const embed = createMyWagersEmbed(
      wagers.map((w: any) => ({
        task: w.task,
        deadline: w.deadline,
        status: "active" as const,
      }))
    );

    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { embeds: [embed], flags: 64 },
    });
  } catch (error) {
    console.error("Error fetching wagers:", error);
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Failed to fetch your wagers.", flags: 64 },
    });
  }
}

async function handleLeaderboardCommand(ctx: any, guildId: string) {
  try {
    const leaderboard = await ctx.runQuery(api.leaderboard.getServerLeaderboard, {
      guildId,
    });

    // Use the new embed helper with website-matched amber color
    const embed = createLeaderboardEmbed(
      leaderboard.mostReliable || [],
      leaderboard.topBettors // Optional second column
    );

    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { embeds: [embed] },
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Failed to fetch leaderboard.", flags: 64 },
    });
  }
}

async function handleSetupCommand(
  ctx: any,
  interaction: any,
  guildId: string,
  options: any[]
) {
  // Check permissions (admin only)
  const permissions = BigInt(interaction.member?.permissions || 0);
  const ADMINISTRATOR = BigInt(1 << 3);

  if ((permissions & ADMINISTRATOR) !== ADMINISTRATOR) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "Only administrators can configure the bot.",
        flags: 64,
      },
    });
  }

  const wagersChannel = options?.find((o: any) => o.name === "wagers")?.value;
  const proofChannel = options?.find((o: any) => o.name === "proof")?.value;
  const resultsChannel = options?.find((o: any) => o.name === "results")?.value;

  try {
    await ctx.runMutation(api.discord.configureServer, {
      guildId,
      guildName: interaction.guild?.name || "Unknown",
      wagersChannelId: wagersChannel,
      proofChannelId: proofChannel,
      announcementsChannelId: resultsChannel,
    });

    let response = "Bot configured!";
    if (wagersChannel) response += `\nWagers: <#${wagersChannel}>`;
    if (proofChannel) response += `\nProof: <#${proofChannel}>`;
    if (resultsChannel) response += `\nResults: <#${resultsChannel}>`;

    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: response, flags: 64 },
    });
  } catch (error) {
    console.error("Error configuring server:", error);
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Failed to configure server.", flags: 64 },
    });
  }
}

async function handleRewardCommand(
  ctx: any,
  interaction: any,
  issuer: any,
  guildId: string,
  options: any[]
) {
  // Check permissions (admin only)
  const permissions = BigInt(interaction.member?.permissions || 0);
  const ADMINISTRATOR = BigInt(1 << 3);

  if ((permissions & ADMINISTRATOR) !== ADMINISTRATOR) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "Only administrators can issue rewards.",
        flags: 64,
      },
    });
  }

  // Get command options
  const targetUser = options?.find((o: any) => o.name === "user")?.value;
  const amount = options?.find((o: any) => o.name === "amount")?.value;
  const reason = options?.find((o: any) => o.name === "reason")?.value || "Admin reward";

  if (!targetUser || amount === undefined) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Missing user or amount", flags: 64 },
    });
  }

  // Get the target user details from resolved data
  const resolvedUser = interaction.data.resolved?.users?.[targetUser];
  if (!resolvedUser) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Could not resolve user", flags: 64 },
    });
  }

  try {
    const result = await ctx.runMutation(api.rewards.issueReward, {
      guildId,
      recipientDiscordId: resolvedUser.id,
      recipientUsername: resolvedUser.username,
      amount,
      reason,
      issuedByDiscordId: issuer.id,
      issuedByUsername: issuer.username,
    });

    const symbol = amount > 0 ? "+" : "−";
    const action = amount > 0 ? "awarded" : "deducted";
    const absAmount = Math.abs(amount);

    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `${symbol} **${absAmount} points** ${action} ${amount > 0 ? "to" : "from"} <@${resolvedUser.id}>\n▪ Reason: ${reason}\n● New balance: **${result.newPoints} points**`,
      },
    });
  } catch (error: any) {
    const errorMessage = cleanErrorMessage(error);
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `✗ ${errorMessage}`,
        flags: 64,
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Component Interaction Handler (Buttons & Select Menus)
// ═══════════════════════════════════════════════════════════════

// Store selected bet amounts temporarily (in-memory, per interaction)
// In production, you might want to use a database or session storage
const selectedBetAmounts = new Map<string, number>();

async function handleButtonClick(ctx: any, interaction: any) {
  const customId = interaction.data.custom_id;
  const user = interaction.member?.user || interaction.user;
  const guildId = interaction.guild_id;

  // Handle bet amount select menu
  if (customId.startsWith("bet_amount_")) {
    const wagerId = customId.replace("bet_amount_", "");
    const selectedValue = interaction.data.values?.[0];

    if (selectedValue === "custom") {
      // For custom amounts, just acknowledge - they need to use buttons
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "▸ To bet a custom amount, use the web app at wager.app",
          flags: 64,
        },
      });
    }

    const amount = parseInt(selectedValue, 10);
    if (!isNaN(amount)) {
      // Store the selected amount for this user/wager combo
      selectedBetAmounts.set(`${user.id}_${wagerId}`, amount);
    }

    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `● Bet amount set to **${amount} points**. Now click a prediction button!`,
        flags: 64,
      },
    });
  }

  // Handle bet buttons
  if (customId.startsWith("bet_success_") || customId.startsWith("bet_fail_")) {
    const parsed = parseCustomId(customId);
    const wagerId = parsed.wagerId;
    const prediction = parsed.prediction;

    if (!wagerId || !prediction) {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "Invalid bet action", flags: 64 },
      });
    }

    // Get the selected bet amount, default to 10
    const betKey = `${user.id}_${wagerId}`;
    const betAmount = selectedBetAmounts.get(betKey) || 10;
    // Clear the stored amount after use
    selectedBetAmounts.delete(betKey);

    try {
      // Check if user can bet first
      const canBet = await ctx.runQuery(api.bets.canUserBet, {
        discordId: user.id,
        guildId,
      });

      if (!canBet.canBet) {
        return Response.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✗ ${canBet.reason}`,
            flags: 64,
          },
        });
      }

      // Place the bet
      const result = await ctx.runMutation(api.bets.placeBet, {
        wagerId,
        oddsmakerDiscordId: user.id,
        oddsmakerUsername: user.username,
        prediction: prediction,
        pointsWagered: betAmount,
      });

      // Use the new styled embed for confirmation
      const embed = createBetConfirmationEmbed(
        prediction,
        betAmount,
        result.remainingPoints
      );

      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          flags: 64,
        },
      });
    } catch (error: any) {
      const errorMessage = cleanErrorMessage(error);
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `✗ ${errorMessage}`,
          flags: 64,
        },
      });
    }
  }

  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "✗ Unknown action", flags: 64 },
  });
}

// ═══════════════════════════════════════════════════════════════
// Server Configuration Mutations
// ═══════════════════════════════════════════════════════════════
export const configureServer = mutation({
  args: {
    guildId: v.string(),
    guildName: v.string(),
    wagersChannelId: v.optional(v.string()),
    proofChannelId: v.optional(v.string()),
    announcementsChannelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("discordServers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        guildName: args.guildName,
        wagersChannelId: args.wagersChannelId,
        proofChannelId: args.proofChannelId,
        announcementsChannelId: args.announcementsChannelId,
      });
    } else {
      await ctx.db.insert("discordServers", {
        guildId: args.guildId,
        guildName: args.guildName,
        wagersChannelId: args.wagersChannelId,
        proofChannelId: args.proofChannelId,
        announcementsChannelId: args.announcementsChannelId,
        addedAt: Date.now(),
      });
    }
  },
});

// Query to get server by guildId (used for resolving guild names)
export const getServerByGuildId = query({
  args: { guildId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("discordServers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .unique();
  },
});

export const registerServer = mutation({
  args: {
    guildId: v.string(),
    guildName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("discordServers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!existing) {
      await ctx.db.insert("discordServers", {
        guildId: args.guildId,
        guildName: args.guildName,
        addedAt: Date.now(),
      });
    } else if (args.guildName !== "Unknown Server" && existing.guildName === "Unknown Server") {
      // Update the name if we now have a real one
      await ctx.db.patch(existing._id, { guildName: args.guildName });
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Gateway Bot Sync - Called by the discord.js Gateway bot
// ═══════════════════════════════════════════════════════════════
export const syncServer = mutation({
  args: {
    guildId: v.string(),
    guildName: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("discordServers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (existing) {
      // Update existing server
      await ctx.db.patch(existing._id, {
        guildName: args.guildName,
        isActive: args.isActive,
        lastSyncedAt: Date.now(),
      });
      console.log(`Synced server ${args.guildName} (${args.guildId}): isActive=${args.isActive}`);
    } else if (args.isActive) {
      // Only insert if the bot is actually in the server
      await ctx.db.insert("discordServers", {
        guildId: args.guildId,
        guildName: args.guildName,
        isActive: true,
        addedAt: Date.now(),
        lastSyncedAt: Date.now(),
      });
      console.log(`Registered new server via sync: ${args.guildName} (${args.guildId})`);
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Post Wager to Discord (for web-created wagers)
// ═══════════════════════════════════════════════════════════════
export const postWagerToDiscord = internalAction({
  args: {
    wagerId: v.id("wagers"),
    guildId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get wager details
    const wager = await ctx.runQuery(internal.wagers.getWagerInternal, {
      wagerId: args.wagerId,
    });
    if (!wager) {
      console.error("Wager not found:", args.wagerId);
      return;
    }

    // Get user details
    const user = await ctx.runQuery(internal.wagers.getUserInternal, {
      userId: args.userId,
    });
    if (!user) {
      console.error("User not found:", args.userId);
      return;
    }

    // Get server configuration
    const server = await ctx.runQuery(internal.discord.getServerConfig, {
      guildId: args.guildId,
    });
    if (!server || !server.wagersChannelId) {
      console.error("Server not configured or no wagers channel:", args.guildId);
      return;
    }

    // Create the enhanced embed with website-matched colors
    const embed = createWagerEmbed(
      user.discordDisplayName || user.discordUsername,
      user.discordAvatarUrl || null,
      getWagerTask(wager),
      wager.consequence,
      getWagerDeadline(wager),
      args.wagerId
    );

    // Create enhanced betting buttons with amount selector
    const components = createBettingButtons(args.wagerId);

    // Post to Discord via REST API
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      console.error("DISCORD_BOT_TOKEN not configured");
      return;
    }

    try {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${server.wagersChannelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [embed],
            components,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to post to Discord:", error);
        return;
      }

      const message = await response.json();

      // Update wager with message ID
      await ctx.runMutation(api.wagers.updateWagerMessageId, {
        wagerId: args.wagerId,
        messageId: message.id,
        channelId: server.wagersChannelId,
      });

      console.log("Posted wager to Discord:", message.id);
    } catch (error) {
      console.error("Error posting to Discord:", error);
    }
  },
});

// Internal query to get server config
export const getServerConfig = internalQuery({
  args: { guildId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("discordServers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .unique();
  },
});

// ═══════════════════════════════════════════════════════════════
// Post Result to Discord (with audio attachment)
// ═══════════════════════════════════════════════════════════════
export const postResultToDiscord = internalAction({
  args: {
    wagerId: v.id("wagers"),
    passed: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get wager details
    const wager = await ctx.runQuery(internal.wagers.getWagerInternal, {
      wagerId: args.wagerId,
    });
    if (!wager || !wager.guildId) {
      console.error("Wager not found or missing guildId:", args.wagerId);
      return;
    }

    // Get user details
    const user = await ctx.runQuery(internal.wagers.getUserInternal, {
      userId: wager.userId,
    });
    if (!user) {
      console.error("User not found:", wager.userId);
      return;
    }

    // Get server configuration
    const server = await ctx.runQuery(internal.discord.getServerConfig, {
      guildId: wager.guildId,
    });
    if (!server || !server.announcementsChannelId) {
      console.error("Server not configured or no announcements channel:", wager.guildId);
      return;
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      console.error("DISCORD_BOT_TOKEN not configured");
      return;
    }

    // Create enhanced result embed with website-matched colors
    const embed = createResultEmbed(
      user.discordDisplayName || user.discordUsername,
      user.discordAvatarUrl || null,
      getWagerTask(wager),
      args.passed,
      wager.verificationResult?.reasoning || (args.passed ? "Task completed!" : "Deadline passed without valid proof."),
      wager.verificationResult?.confidence, // Pass confidence for progress bar
      undefined, // totalPool - could be calculated if needed
      wager.proofImageUrl // Show proof image for successful wagers
    );

    // Check if we have audio to attach
    let audioBuffer: ArrayBuffer | null = null;
    if (wager.resultAudioUrl) {
      try {
        const audioResponse = await fetch(wager.resultAudioUrl);
        if (audioResponse.ok) {
          audioBuffer = await audioResponse.arrayBuffer();
        }
      } catch (error) {
        console.error("Failed to fetch audio:", error);
      }
    }

    try {
      let response: Response;

      if (audioBuffer) {
        // Post with audio attachment using multipart/form-data
        const formData = new FormData();

        // Add the JSON payload
        const payload = {
          embeds: [embed],
          attachments: [{ id: 0, filename: args.passed ? "victory.mp3" : "roast.mp3" }],
        };
        formData.append("payload_json", JSON.stringify(payload));

        // Add the audio file
        const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
        formData.append("files[0]", audioBlob, args.passed ? "victory.mp3" : "roast.mp3");

        response = await fetch(
          `https://discord.com/api/v10/channels/${server.announcementsChannelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
            },
            body: formData,
          }
        );
      } else {
        // Post without audio
        response = await fetch(
          `https://discord.com/api/v10/channels/${server.announcementsChannelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ embeds: [embed] }),
          }
        );
      }

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to post result to Discord:", error);
        return;
      }

      const message = await response.json();

      // Update wager with result message ID
      await ctx.runMutation(internal.discord.updateWagerResultMessageId, {
        wagerId: args.wagerId,
        messageId: message.id,
      });

      console.log("Posted result to Discord:", message.id, audioBuffer ? "(with audio)" : "(no audio)");
    } catch (error) {
      console.error("Error posting result to Discord:", error);
    }
  },
});

// Update wager with result message ID
export const updateWagerResultMessageId = internalMutation({
  args: {
    wagerId: v.id("wagers"),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.wagerId, {
      resultMessageId: args.messageId,
    });
  },
});

// ═══════════════════════════════════════════════════════════════
// Post Proof to Discord (for web-submitted proofs)
// ═══════════════════════════════════════════════════════════════
export const postProofToDiscord = internalAction({
  args: {
    wagerId: v.id("wagers"),
    proofUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Get wager details
    const wager = await ctx.runQuery(internal.wagers.getWagerInternal, {
      wagerId: args.wagerId,
    });
    if (!wager || !wager.guildId) {
      console.error("Wager not found or missing guildId:", args.wagerId);
      return;
    }

    // Get user details
    const user = await ctx.runQuery(internal.wagers.getUserInternal, {
      userId: wager.userId,
    });
    if (!user) {
      console.error("User not found:", wager.userId);
      return;
    }

    // Get server configuration
    const server = await ctx.runQuery(internal.discord.getServerConfig, {
      guildId: wager.guildId,
    });
    if (!server || !server.proofChannelId) {
      console.error("Server not configured or no proof channel:", wager.guildId);
      return;
    }

    // Create proof submission embed with website-matched warning color
    const embed = createProofEmbed(
      user.discordDisplayName || user.discordUsername,
      user.discordAvatarUrl || null,
      getWagerTask(wager),
      args.proofUrl,
      getWagerDeadline(wager),
      args.wagerId
    );

    // Post to Discord via REST API
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      console.error("DISCORD_BOT_TOKEN not configured");
      return;
    }

    try {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${server.proofChannelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [embed],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to post proof to Discord:", error);
        return;
      }

      const message = await response.json();
      console.log("Posted proof to Discord:", message.id);
    } catch (error) {
      console.error("Error posting proof to Discord:", error);
    }
  },
});
