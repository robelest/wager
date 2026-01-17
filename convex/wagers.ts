import {
  mutation,
  query,
  action,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// Public Mutations (called from Discord bot)
// ═══════════════════════════════════════════════════════════════

// Create a wager from Discord
export const createWagerFromDiscord = mutation({
  args: {
    discordId: v.string(),
    discordUsername: v.string(),
    discordDisplayName: v.optional(v.string()),
    discordAvatarUrl: v.optional(v.string()),
    guildId: v.string(),
    task: v.string(),
    consequence: v.string(),
    deadlineHours: v.number(),
  },
  handler: async (ctx, args) => {
    // Find or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        betterAuthUserId: args.discordId, // Will be updated when they OAuth
        discordId: args.discordId,
        discordUsername: args.discordUsername,
        discordDisplayName: args.discordDisplayName,
        discordAvatarUrl: args.discordAvatarUrl,
        totalWagers: 0,
        completedWagers: 0,
        failedWagers: 0,
        currentStreak: 0,
        longestStreak: 0,
      });
      user = await ctx.db.get(userId);
    }

    if (!user) throw new Error("Failed to create user");

    const deadline = Date.now() + args.deadlineHours * 60 * 60 * 1000;

    // Create the wager
    const wagerId = await ctx.db.insert("wagers", {
      userId: user._id,
      guildId: args.guildId,
      task: args.task,
      consequence: args.consequence,
      deadline,
      status: "active",
      createdAt: Date.now(),
    });

    // Update user stats
    await ctx.db.patch(user._id, {
      totalWagers: user.totalWagers + 1,
    });

    // Create or update user server stats (for points system)
    const existingStats = await ctx.db
      .query("userServerStats")
      .withIndex("by_userId_guildId", (q) =>
        q.eq("userId", user._id).eq("guildId", args.guildId)
      )
      .unique();

    if (!existingStats) {
      await ctx.db.insert("userServerStats", {
        userId: user._id,
        guildId: args.guildId,
        points: 100, // Starting balance
        totalPointsWon: 0,
        totalPointsLost: 0,
        totalBets: 0,
        correctBets: 0,
      });
    }

    return { wagerId, userId: user._id };
  },
});

// Update wager with Discord message ID
export const updateWagerMessageId = mutation({
  args: {
    wagerId: v.string(),
    messageId: v.string(),
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    const wagerId = args.wagerId as Id<"wagers">;
    await ctx.db.patch(wagerId, {
      commitmentMessageId: args.messageId,
      commitmentChannelId: args.channelId,
    });
  },
});

// Submit proof for a wager
export const submitProofFromDiscord = mutation({
  args: {
    discordId: v.string(),
    imageUrl: v.string(),
    messageId: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (!user) {
      return { success: false, message: "User not found" };
    }

    // Find their active wager
    const wager = await ctx.db
      .query("wagers")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();

    if (!wager) {
      return { success: false, message: "No active wager found" };
    }

    // Update wager with proof
    await ctx.db.patch(wager._id, {
      proofImageUrl: args.imageUrl,
      proofMessageId: args.messageId,
    });

    // Schedule verification
    await ctx.scheduler.runAfter(0, internal.wagers.verifyProof, {
      wagerId: wager._id,
    });

    return { success: true, task: wager.task, wagerId: wager._id };
  },
});

// ═══════════════════════════════════════════════════════════════
// Web App Queries (for authenticated users via Better Auth)
// ═══════════════════════════════════════════════════════════════

// Get current user's profile and stats
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) =>
        q.eq("betterAuthUserId", identity.subject)
      )
      .unique();

    return user;
  },
});

// Get current user's wagers
export const getMyWagers = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("pending"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) =>
        q.eq("betterAuthUserId", identity.subject)
      )
      .unique();

    if (!user) return [];

    if (args.status) {
      return await ctx.db
        .query("wagers")
        .withIndex("by_userId_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("wagers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

// Get recent wagers (for live feed - public)
export const getRecentWagers = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const wagers = await ctx.db
      .query("wagers")
      .order("desc")
      .take(limit);

    // Fetch user info for each wager
    const wagersWithUsers = await Promise.all(
      wagers.map(async (wager) => {
        const user = await ctx.db.get(wager.userId);
        return {
          _id: wager._id,
          task: wager.task,
          consequence: wager.consequence,
          status: wager.status,
          createdAt: wager.createdAt,
          user: user
            ? {
                name: user.discordDisplayName || user.discordUsername,
                avatar: user.discordAvatarUrl,
              }
            : null,
        };
      })
    );

    return wagersWithUsers;
  },
});

// Get all guild IDs where the bot is installed (for client-side filtering)
export const getBotServerIds = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const servers = await ctx.db.query("discordServers").collect();
    return servers.map((s) => s.guildId);
  },
});

// Internal query to get all bot servers (with full details)
export const getAllBotServers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("discordServers").collect();
  },
});

// Internal query to get user's stats for specific guilds
export const getUserServerStatsForGuilds = internalQuery({
  args: {
    betterAuthUserId: v.string(),
    guildIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Find user
    const user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) =>
        q.eq("betterAuthUserId", args.betterAuthUserId)
      )
      .unique();

    if (!user) return [];

    // Get stats for specified guilds
    const allStats = await ctx.db
      .query("userServerStats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const guildIdSet = new Set(args.guildIds);
    return allStats.filter((s) => guildIdSet.has(s.guildId));
  },
});

// Create a wager from the web app
export const createWagerFromWeb = mutation({
  args: {
    guildId: v.string(),
    task: v.string(),
    consequence: v.string(),
    deadlineHours: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Find user by Better Auth ID
    let user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) =>
        q.eq("betterAuthUserId", identity.subject)
      )
      .unique();

    if (!user) {
      // User exists in Better Auth but not in our users table yet
      // This can happen if they signed up via web but never used Discord
      throw new Error("Please use /wager in Discord first to set up your account");
    }

    // Verify the server exists and bot is present
    const server = await ctx.db
      .query("discordServers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!server) {
      throw new Error("Discord server not found. Make sure the Wager bot is installed.");
    }

    const deadline = Date.now() + args.deadlineHours * 60 * 60 * 1000;

    // Create the wager
    const wagerId = await ctx.db.insert("wagers", {
      userId: user._id,
      guildId: args.guildId,
      task: args.task,
      consequence: args.consequence,
      deadline,
      status: "active",
      createdAt: Date.now(),
    });

    // Update user stats
    await ctx.db.patch(user._id, {
      totalWagers: user.totalWagers + 1,
    });

    // Create or update user server stats (for points system)
    const existingStats = await ctx.db
      .query("userServerStats")
      .withIndex("by_userId_guildId", (q) =>
        q.eq("userId", user._id).eq("guildId", args.guildId)
      )
      .unique();

    if (!existingStats) {
      await ctx.db.insert("userServerStats", {
        userId: user._id,
        guildId: args.guildId,
        points: 100,
        totalPointsWon: 0,
        totalPointsLost: 0,
        totalBets: 0,
        correctBets: 0,
      });
    }

    // Schedule posting to Discord
    await ctx.scheduler.runAfter(0, internal.discord.postWagerToDiscord, {
      wagerId,
      guildId: args.guildId,
      userId: user._id,
    });

    return { wagerId, userId: user._id };
  },
});

// Generate upload URL for proof image
export const generateProofUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Submit proof from web app
export const submitProofFromWeb = mutation({
  args: {
    wagerId: v.id("wagers"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Find user
    const user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) =>
        q.eq("betterAuthUserId", identity.subject)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Get the wager
    const wager = await ctx.db.get(args.wagerId);
    if (!wager) {
      throw new Error("Wager not found");
    }

    // Verify ownership
    if (wager.userId !== user._id) {
      throw new Error("You can only submit proof for your own wagers");
    }

    // Check status
    if (wager.status !== "active") {
      throw new Error("Can only submit proof for active wagers");
    }

    // Get the file URL
    const proofUrl = await ctx.storage.getUrl(args.storageId);
    if (!proofUrl) {
      throw new Error("Failed to get proof URL");
    }

    // Update wager with proof
    await ctx.db.patch(args.wagerId, {
      proofImageUrl: proofUrl,
      proofStorageId: args.storageId,
    });

    // Schedule verification
    await ctx.scheduler.runAfter(0, internal.wagers.verifyProof, {
      wagerId: args.wagerId,
    });

    // Schedule posting to Discord proof channel
    await ctx.scheduler.runAfter(0, internal.discord.postProofToDiscord, {
      wagerId: args.wagerId,
      proofUrl,
    });

    return { success: true, proofUrl };
  },
});

// Get global stats (for landing page)
export const getGlobalStats = query({
  args: {},
  handler: async (ctx) => {
    // Get all users for aggregate stats
    const users = await ctx.db.query("users").collect();

    const totalUsers = users.length;
    const totalWagers = users.reduce((sum, u) => sum + u.totalWagers, 0);
    const completedWagers = users.reduce((sum, u) => sum + u.completedWagers, 0);
    const failedWagers = users.reduce((sum, u) => sum + u.failedWagers, 0);

    // Get active wagers count
    const activeWagers = await ctx.db
      .query("wagers")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const successRate =
      completedWagers + failedWagers > 0
        ? Math.round((completedWagers / (completedWagers + failedWagers)) * 100)
        : 0;

    return {
      totalUsers,
      totalWagers,
      completedWagers,
      activeWagersCount: activeWagers.length,
      successRate,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Discord Bot Queries
// ═══════════════════════════════════════════════════════════════

// Get user's active wagers
export const getUserActiveWagers = query({
  args: {
    discordId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (!user) return [];

    return await ctx.db
      .query("wagers")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .collect();
  },
});

// Get wager by ID (basic)
export const getWagerById = query({
  args: { wagerId: v.id("wagers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.wagerId);
  },
});

// Get wager with full details (for detail page)
export const getWagerWithDetails = query({
  args: { wagerId: v.id("wagers") },
  handler: async (ctx, args) => {
    const wager = await ctx.db.get(args.wagerId);
    if (!wager) return null;

    // Get wager owner
    const owner = await ctx.db.get(wager.userId);

    // Get server info
    const server = wager.guildId
      ? await ctx.db
          .query("discordServers")
          .withIndex("by_guildId", (q) => q.eq("guildId", wager.guildId!))
          .unique()
      : null;

    // Check if current user is the owner
    const identity = await ctx.auth.getUserIdentity();
    let isOwner = false;
    if (identity && owner) {
      const currentUser = await ctx.db
        .query("users")
        .withIndex("by_betterAuthUserId", (q) =>
          q.eq("betterAuthUserId", identity.subject)
        )
        .unique();
      isOwner = currentUser?._id === owner._id;
    }

    return {
      ...wager,
      user: owner
        ? {
            name: owner.discordDisplayName || owner.discordUsername,
            avatar: owner.discordAvatarUrl,
          }
        : null,
      server: server
        ? {
            guildId: server.guildId,
            guildName: server.guildName,
          }
        : null,
      isOwner,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Internal Functions
// ═══════════════════════════════════════════════════════════════

// Internal query to get wager
export const getWagerInternal = internalQuery({
  args: { wagerId: v.id("wagers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.wagerId);
  },
});

// Internal query to get user
export const getUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Verify proof using Claude
export const verifyProof = internalAction({
  args: { wagerId: v.id("wagers") },
  handler: async (ctx, args) => {
    const wager = await ctx.runQuery(internal.wagers.getWagerInternal, {
      wagerId: args.wagerId,
    });

    if (!wager || !wager.proofImageUrl) {
      console.error("Wager or proof not found");
      return;
    }

    // Call Claude to verify the proof
    const verification = await ctx.runAction(
      internal.integrations.claude.verifyProofImage,
      {
        imageUrl: wager.proofImageUrl,
        task: wager.task,
        consequence: wager.consequence,
      }
    );

    // Update wager with verification result
    await ctx.runMutation(internal.wagers.updateVerificationResult, {
      wagerId: args.wagerId,
      verificationResult: verification,
    });

    // If verified, complete the wager
    if (verification.passed && verification.confidence >= 70) {
      await ctx.runMutation(internal.wagers.completeWager, {
        wagerId: args.wagerId,
        passed: true,
      });

      // Generate celebratory audio
      await ctx.runAction(internal.wagers.generateResultAudio, {
        wagerId: args.wagerId,
        isSuccess: true,
      });
    }
  },
});

// Update verification result
export const updateVerificationResult = internalMutation({
  args: {
    wagerId: v.id("wagers"),
    verificationResult: v.object({
      passed: v.boolean(),
      confidence: v.number(),
      reasoning: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.wagerId, {
      verificationResult: args.verificationResult,
    });
  },
});

// Complete a wager
export const completeWager = internalMutation({
  args: {
    wagerId: v.id("wagers"),
    passed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const wager = await ctx.db.get(args.wagerId);
    if (!wager) return;

    const user = await ctx.db.get(wager.userId);
    if (!user) return;

    // Update wager status
    await ctx.db.patch(args.wagerId, {
      status: args.passed ? "completed" : "failed",
      completedAt: Date.now(),
    });

    // Update user stats
    if (args.passed) {
      await ctx.db.patch(user._id, {
        completedWagers: user.completedWagers + 1,
        currentStreak: user.currentStreak + 1,
        longestStreak: Math.max(user.longestStreak, user.currentStreak + 1),
      });
    } else {
      await ctx.db.patch(user._id, {
        failedWagers: user.failedWagers + 1,
        currentStreak: 0,
      });
    }

    // Settle all bets on this wager
    await ctx.scheduler.runAfter(0, internal.bets.settleBets, {
      wagerId: args.wagerId,
      passed: args.passed,
    });

    // Award creator bonus/penalty in their server stats
    if (wager.guildId) {
      const creatorStats = await ctx.db
        .query("userServerStats")
        .withIndex("by_userId_guildId", (q) =>
          q.eq("userId", user._id).eq("guildId", wager.guildId!)
        )
        .unique();

      if (creatorStats) {
        const bonus = args.passed ? 10 : -5;
        await ctx.db.patch(creatorStats._id, {
          points: Math.max(0, creatorStats.points + bonus),
          totalPointsWon: args.passed
            ? creatorStats.totalPointsWon + 10
            : creatorStats.totalPointsWon,
          totalPointsLost: !args.passed
            ? creatorStats.totalPointsLost + 5
            : creatorStats.totalPointsLost,
        });
      }
    }
  },
});

// Generate result audio and post to Discord
export const generateResultAudio = internalAction({
  args: {
    wagerId: v.id("wagers"),
    isSuccess: v.boolean(),
  },
  handler: async (ctx, args) => {
    const wager = await ctx.runQuery(internal.wagers.getWagerInternal, {
      wagerId: args.wagerId,
    });

    if (!wager) return;

    const user = await ctx.runQuery(internal.wagers.getUserInternal, {
      userId: wager.userId,
    });

    if (!user) return;

    // Try to generate audio (may fail if ELEVENLABS_API_KEY not set)
    let audioGenerated = false;
    try {
      // Generate script and audio via ElevenLabs
      const script = await ctx.runAction(
        internal.integrations.elevenlabs.generateResultScript,
        {
          username: user.discordDisplayName || user.discordUsername,
          task: wager.task,
          consequence: wager.consequence,
          isSuccess: args.isSuccess,
          confidence: wager.verificationResult?.confidence || 0,
        }
      );

      const { storageId } = await ctx.runAction(
        internal.integrations.elevenlabs.generateResultAudio,
        {
          text: script,
          isSuccess: args.isSuccess,
        }
      );

      // Update wager with audio
      await ctx.runMutation(internal.wagers.updateResultAudio, {
        wagerId: args.wagerId,
        audioStorageId: storageId,
      });

      audioGenerated = true;
    } catch (error) {
      console.log("Audio generation skipped (ElevenLabs not configured or error):", error);
    }

    // Post result to Discord (with or without audio)
    // Small delay to ensure audio URL is saved if it was generated
    await ctx.scheduler.runAfter(audioGenerated ? 1000 : 0, internal.discord.postResultToDiscord, {
      wagerId: args.wagerId,
      passed: args.isSuccess,
    });
  },
});

// Update result audio
export const updateResultAudio = internalMutation({
  args: {
    wagerId: v.id("wagers"),
    audioStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.audioStorageId);
    // Only update if URL is valid (storage.getUrl can return null)
    if (url) {
      await ctx.db.patch(args.wagerId, {
        resultAudioStorageId: args.audioStorageId,
        resultAudioUrl: url,
      });
    }
  },
});

// Get all active wagers (for monitoring)
export const getActiveWagers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("wagers")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

// Check for expired wagers
export const checkExpiredWagers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredWagers = await ctx.db
      .query("wagers")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.lt(q.field("deadline"), now))
      .collect();

    for (const wager of expiredWagers) {
      // Mark as failed if no valid proof
      if (!wager.verificationResult?.passed) {
        await ctx.db.patch(wager._id, {
          status: "failed",
          completedAt: now,
        });

        const user = await ctx.db.get(wager.userId);
        if (user) {
          await ctx.db.patch(user._id, {
            failedWagers: user.failedWagers + 1,
            currentStreak: 0,
          });
        }

        // Settle bets for this failed wager
        await ctx.scheduler.runAfter(0, internal.bets.settleBets, {
          wagerId: wager._id,
          passed: false,
        });

        // Generate failure audio and post to Discord
        await ctx.scheduler.runAfter(0, internal.wagers.generateResultAudio, {
          wagerId: wager._id,
          isSuccess: false,
        });
      }
    }

    return expiredWagers.length;
  },
});
