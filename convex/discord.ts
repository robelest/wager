import { httpAction, mutation, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import nacl from "tweetnacl";
import { internal, api } from "./_generated/api";

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

// ═══════════════════════════════════════════════════════════════
// Embed Builders
// ═══════════════════════════════════════════════════════════════
function createWagerEmbed(
  username: string,
  avatarUrl: string | null,
  task: string,
  consequence: string,
  deadline: number,
  wagerId: string
) {
  return {
    color: 0x5865f2, // Discord blurple
    title: "PUBLIC WAGER",
    author: {
      name: username,
      icon_url: avatarUrl || undefined,
    },
    fields: [
      { name: "I commit to:", value: task, inline: false },
      { name: "If I fail:", value: consequence, inline: false },
      {
        name: "Deadline",
        value: `<t:${Math.floor(deadline / 1000)}:R>`,
        inline: true,
      },
    ],
    footer: { text: `Wager ID: ${wagerId}` },
    timestamp: new Date().toISOString(),
  };
}

function createResultEmbed(
  username: string,
  avatarUrl: string | null,
  task: string,
  passed: boolean,
  reasoning: string
) {
  return {
    color: passed ? 0x57f287 : 0xed4245, // Green or Red
    title: passed ? "WAGER COMPLETED!" : "WAGER FAILED!",
    author: {
      name: username,
      icon_url: avatarUrl || undefined,
    },
    description: passed ? "They actually did it!" : "Time for consequences...",
    fields: [
      { name: "Task", value: task, inline: false },
      { name: "Verification", value: reasoning, inline: false },
    ],
    timestamp: new Date().toISOString(),
  };
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
  const guildName = interaction.guild?.name || "Unknown Server";

  // Auto-register server if it doesn't exist (so users don't have to run /setup first)
  if (guildId) {
    await ctx.runMutation(api.discord.registerServer, {
      guildId,
      guildName,
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
  interaction: any,
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
    const embed = createWagerEmbed(
      user.global_name || user.username,
      user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
      task,
      consequence,
      deadline,
      result.wagerId
    );

    // Betting buttons
    const components = [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 3, // SUCCESS (green)
            label: "They'll do it",
            emoji: { name: "✅" },
            custom_id: `bet_success_${result.wagerId}`,
          },
          {
            type: 2, // BUTTON
            style: 4, // DANGER (red)
            label: "They'll fail",
            emoji: { name: "❌" },
            custom_id: `bet_fail_${result.wagerId}`,
          },
        ],
      },
    ];

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

    if (wagers.length === 0) {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "You have no active wagers. Create one with `/wager`!",
          flags: 64,
        },
      });
    }

    const embed = {
      color: 0x5865f2,
      title: "Your Active Wagers",
      description: wagers
        .map(
          (w: any, i: number) =>
            `**${i + 1}.** ${w.task}\n   *Deadline:* <t:${Math.floor(w.deadline / 1000)}:R>`
        )
        .join("\n\n"),
    };

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

    const embed = {
      color: 0xffd700, // Gold
      title: "Server Leaderboard",
      fields: [
        {
          name: "Most Reliable",
          value:
            leaderboard.mostReliable
              ?.map(
                (u: any, i: number) =>
                  `${["🥇", "🥈", "🥉"][i] || `${i + 1}.`} <@${u.discordId}> - ${u.completedWagers}/${u.totalWagers}`
              )
              .join("\n") || "No data yet",
          inline: false,
        },
        {
          name: "Longest Streak",
          value:
            leaderboard.longestStreak
              ?.map(
                (u: any, i: number) =>
                  `${["🥇", "🥈", "🥉"][i] || `${i + 1}.`} <@${u.discordId}> - ${u.longestStreak} wagers`
              )
              .join("\n") || "No data yet",
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

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

// ═══════════════════════════════════════════════════════════════
// Button Click Handler
// ═══════════════════════════════════════════════════════════════
async function handleButtonClick(ctx: any, interaction: any) {
  const customId = interaction.data.custom_id;
  const user = interaction.member?.user || interaction.user;
  const guildId = interaction.guild_id;

  if (customId.startsWith("bet_")) {
    const [, prediction, wagerId] = customId.split("_");
    const DEFAULT_BET = 10;

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
            content: `🚫 ${canBet.reason}`,
            flags: 64,
          },
        });
      }

      // Get user's current points
      const pointsInfo = await ctx.runQuery(api.bets.getUserServerPoints, {
        discordId: user.id,
        guildId,
      });

      // Place the bet with default 10 points
      const result = await ctx.runMutation(api.bets.placeBet, {
        wagerId,
        oddsmakerDiscordId: user.id,
        oddsmakerUsername: user.username,
        prediction: prediction as "success" | "fail",
        pointsWagered: DEFAULT_BET,
      });

      const emoji = prediction === "success" ? "✅" : "❌";
      const predictionText = prediction === "success" ? "they'll succeed" : "they'll fail";

      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `${emoji} **Bet placed!** You wagered **${DEFAULT_BET} points** that ${predictionText}.\n💰 Remaining balance: **${result.remainingPoints} points**`,
          flags: 64,
        },
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to place bet.";
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ ${errorMessage}`,
          flags: 64,
        },
      });
    }
  }

  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Unknown action", flags: 64 },
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

    // Create the embed
    const embed = createWagerEmbed(
      user.discordDisplayName || user.discordUsername,
      user.discordAvatarUrl || null,
      wager.task,
      wager.consequence,
      wager.deadline,
      args.wagerId
    );

    // Create betting buttons
    const components = [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 3, // SUCCESS (green)
            label: "🎯 They'll do it (10 pts)",
            custom_id: `bet_success_${args.wagerId}`,
          },
          {
            type: 2, // BUTTON
            style: 4, // DANGER (red)
            label: "💀 No way (10 pts)",
            custom_id: `bet_fail_${args.wagerId}`,
          },
        ],
      },
    ];

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

    // Create result embed
    const embed = createResultEmbed(
      user.discordDisplayName || user.discordUsername,
      user.discordAvatarUrl || null,
      wager.task,
      args.passed,
      wager.verificationResult?.reasoning || (args.passed ? "Task completed!" : "Deadline passed without valid proof.")
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

    // Create proof submission embed
    const embed = {
      color: 0xf1c40f, // Yellow
      title: "📸 PROOF SUBMITTED",
      author: {
        name: user.discordDisplayName || user.discordUsername,
        icon_url: user.discordAvatarUrl || undefined,
      },
      description: `Proof submitted for: **${wager.task}**`,
      image: {
        url: args.proofUrl,
      },
      fields: [
        {
          name: "Status",
          value: "🔄 AI verification in progress...",
          inline: true,
        },
        {
          name: "Deadline",
          value: `<t:${Math.floor(wager.deadline / 1000)}:R>`,
          inline: true,
        },
      ],
      footer: { text: `Wager ID: ${args.wagerId}` },
      timestamp: new Date().toISOString(),
    };

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
