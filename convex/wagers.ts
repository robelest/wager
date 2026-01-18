import {
  mutation,
  query,
  action,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal, api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getWagerTask } from "./validators";

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

// Compute user stats from wagers (replaces denormalized fields)
export const getUserStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const wagers = await ctx.db
      .query("wagers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const totalWagers = wagers.length;
    const completedWagers = wagers.filter((w) => w.status === "completed").length;
    const failedWagers = wagers.filter((w) => w.status === "failed").length;
    const activeWagers = wagers.filter((w) => w.status === "active").length;

    return {
      totalWagers,
      completedWagers,
      failedWagers,
      activeWagers,
    };
  },
});

// Get stats for current user
export const getMyStats = query({
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

    if (!user) return null;

    const wagers = await ctx.db
      .query("wagers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const totalWagers = wagers.length;
    const completedWagers = wagers.filter((w) => w.status === "completed").length;
    const failedWagers = wagers.filter((w) => w.status === "failed").length;
    const activeWagers = wagers.filter((w) => w.status === "active").length;

    return {
      totalWagers,
      completedWagers,
      failedWagers,
      activeWagers,
    };
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

// Get wagers from servers user is in (for Server Feed tab)
export const getServerWagers = query({
  args: {
    status: v.optional(v.literal("active")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Find user
    const user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) =>
        q.eq("betterAuthUserId", identity.subject)
      )
      .unique();

    if (!user) return [];

    // Get all servers user is in (via userServerStats)
    const userStats = await ctx.db
      .query("userServerStats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const guildIds = userStats.map((s) => s.guildId);
    if (guildIds.length === 0) return [];

    // Get all active wagers from these servers (excluding user's own)
    const allWagers = await ctx.db
      .query("wagers")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Filter to servers user is in and exclude own wagers
    const serverWagers = allWagers.filter(
      (w) => w.guildId && guildIds.includes(w.guildId) && w.userId !== user._id
    );

    // Enrich with user info and bet stats
    const enrichedWagers = await Promise.all(
      serverWagers.map(async (wager) => {
        const owner = await ctx.db.get(wager.userId);
        const server = wager.guildId
          ? await ctx.db
              .query("discordServers")
              .withIndex("by_guildId", (q) => q.eq("guildId", wager.guildId!))
              .unique()
          : null;

        // Get bet stats
        const bets = await ctx.db
          .query("bets")
          .withIndex("by_wagerId", (q) => q.eq("wagerId", wager._id))
          .collect();

        const successBets = bets.filter((b) => b.prediction === "success");
        const failBets = bets.filter((b) => b.prediction === "fail");

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
          betStats: {
            total: bets.length,
            successCount: successBets.length,
            failCount: failBets.length,
            successPool: successBets.reduce((sum, b) => sum + b.pointsWagered, 0),
            failPool: failBets.reduce((sum, b) => sum + b.pointsWagered, 0),
          },
        };
      })
    );

    // Sort by creation date descending
    return enrichedWagers.sort((a, b) => b.createdAt - a.createdAt);
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

// Internal mutation to create wager (called by action after user lookup)
export const createWagerInternal = internalMutation({
  args: {
    discordId: v.string(),
    betterAuthUserId: v.string(),
    guildId: v.string(),
    task: v.string(),
    consequence: v.string(),
    deadlineHours: v.number(),
  },
  handler: async (ctx, args) => {
    // Find user by Discord ID
    let user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (!user) {
      throw new Error("User not found. Please use /wager in Discord first.");
    }

    // Link Better Auth ID if not already linked
    if (user.betterAuthUserId !== args.betterAuthUserId) {
      await ctx.db.patch(user._id, { betterAuthUserId: args.betterAuthUserId });
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

    return { wagerId, oddsmakerDiscordId: user._id };
  },
});

// Create a wager from the web app
export const createWagerFromWeb = action({
  args: {
    guildId: v.string(),
    task: v.string(),
    consequence: v.string(),
    deadlineHours: v.number(),
  },
  handler: async (ctx, args): Promise<{ wagerId: Id<"wagers">; oddsmakerDiscordId: Id<"users"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get Discord ID from Better Auth account table
    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "providerId", operator: "eq", value: "discord" },
        { field: "userId", operator: "eq", value: identity.subject },
      ],
    });

    if (!account?.accountId) {
      throw new Error("Discord account not found. Please sign in with Discord.");
    }

    // Create the wager via internal mutation
    const result = await ctx.runMutation(internal.wagers.createWagerInternal, {
      discordId: account.accountId as string,
      betterAuthUserId: identity.subject,
      guildId: args.guildId,
      task: args.task,
      consequence: args.consequence,
      deadlineHours: args.deadlineHours,
    });

    return { wagerId: result.wagerId, oddsmakerDiscordId: result.oddsmakerDiscordId };
  },
});

// Create a multi-task wager from web app
export const createMultiTaskWagerFromWeb = action({
  args: {
    guildId: v.string(),
    title: v.string(), // "Read 5 books"
    consequence: v.string(),
    tasks: v.array(
      v.object({
        description: v.string(),
        deadlineHours: v.number(),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ wagerId: Id<"wagers"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.tasks.length < 2) {
      throw new Error("Multi-task wagers must have at least 2 tasks");
    }

    if (args.tasks.length > 10) {
      throw new Error("Multi-task wagers can have at most 10 tasks");
    }

    // Get Discord ID from Better Auth account table
    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "providerId", operator: "eq", value: "discord" },
        { field: "userId", operator: "eq", value: identity.subject },
      ],
    });

    if (!account?.accountId) {
      throw new Error("Discord account not found. Please sign in with Discord.");
    }

    // Create the multi-task wager via internal mutation
    const result = await ctx.runMutation(internal.wagers.createMultiTaskWagerInternal, {
      discordId: account.accountId as string,
      betterAuthUserId: identity.subject,
      guildId: args.guildId,
      title: args.title,
      consequence: args.consequence,
      tasks: args.tasks,
    });

    return { wagerId: result.wagerId };
  },
});

// Internal mutation to create multi-task wager
export const createMultiTaskWagerInternal = internalMutation({
  args: {
    discordId: v.string(),
    betterAuthUserId: v.string(),
    guildId: v.string(),
    title: v.string(),
    consequence: v.string(),
    tasks: v.array(
      v.object({
        description: v.string(),
        deadlineHours: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Find user by Discord ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (!user) {
      throw new Error("User not found. Please use /wager in Discord first.");
    }

    // Link Better Auth ID if not already linked
    if (user.betterAuthUserId !== args.betterAuthUserId) {
      await ctx.db.patch(user._id, { betterAuthUserId: args.betterAuthUserId });
    }

    // Verify the server exists and bot is present
    const server = await ctx.db
      .query("discordServers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!server) {
      throw new Error("Server not found. Please make sure the Wager bot is added to the server.");
    }

    // Calculate deadlines and find final deadline
    const now = Date.now();
    const tasksWithDeadlines = args.tasks.map((task, index) => ({
      description: task.description,
      deadline: now + task.deadlineHours * 60 * 60 * 1000,
      taskIndex: index,
    }));

    const finalDeadline = Math.max(...tasksWithDeadlines.map((t) => t.deadline));

    // Create the parent wager
    const wagerId = await ctx.db.insert("wagers", {
      userId: user._id,
      guildId: args.guildId,
      task: args.title, // Use title as the main task description
      consequence: args.consequence,
      deadline: finalDeadline, // Use final deadline for backwards compatibility
      status: "active",
      createdAt: now,
      // Multi-task specific fields
      isMultiTask: true,
      wagerTitle: args.title,
      taskCount: args.tasks.length,
      completedTaskCount: 0,
      finalDeadline,
    });

    // Create individual task records
    for (const task of tasksWithDeadlines) {
      await ctx.db.insert("wagerTasks", {
        wagerId,
        description: task.description,
        taskIndex: task.taskIndex,
        deadline: task.deadline,
        status: "pending",
      });
    }

    // Create or update user server stats
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
    // Count users and compute stats from wagers
    const users = await ctx.db.query("users").collect();
    const allWagers = await ctx.db.query("wagers").collect();

    const totalUsers = users.length;
    const totalWagers = allWagers.length;
    const completedWagers = allWagers.filter((w) => w.status === "completed").length;
    const failedWagers = allWagers.filter((w) => w.status === "failed").length;
    const activeWagersCount = allWagers.filter((w) => w.status === "active").length;

    const successRate =
      completedWagers + failedWagers > 0
        ? Math.round((completedWagers / (completedWagers + failedWagers)) * 100)
        : 0;

    return {
      totalUsers,
      totalWagers,
      completedWagers,
      activeWagersCount,
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
        task: getWagerTask(wager),
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

// Helper: Calculate completion reward based on deadline difficulty
function getCompletionReward(deadline: number, createdAt: number): number {
  const hoursToComplete = (deadline - createdAt) / (1000 * 60 * 60);

  if (hoursToComplete <= 24) return 50; // Hard - 24h or less
  if (hoursToComplete <= 48) return 35; // Medium - 24-48h
  if (hoursToComplete <= 72) return 25; // Standard - 48-72h
  return 15; // Easy - 72h+
}


// Forfeit/give up a wager (public mutation for web UI)
export const forfeitWager = mutation({
  args: {
    wagerId: v.id("wagers"),
  },
  handler: async (ctx, args) => {
    // Get current user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const wager = await ctx.db.get(args.wagerId);
    if (!wager) {
      throw new Error("Wager not found");
    }

    if (wager.status !== "active") {
      throw new Error("Can only forfeit active wagers");
    }

    // Get user by Better Auth ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", identity.subject))
      .unique();

    if (!user || user._id !== wager.userId) {
      throw new Error("You can only forfeit your own wagers");
    }

    // Update wager status to failed
    await ctx.db.patch(args.wagerId, {
      status: "failed",
      completedAt: Date.now(),
      verificationResult: {
        passed: false,
        confidence: 100,
        reasoning: "Wager forfeited by creator",
      },
    });

    // Settle all bets on this wager
    await ctx.scheduler.runAfter(0, internal.bets.settleBets, {
      wagerId: args.wagerId,
      passed: false,
    });

    // Apply failure penalty for server points
    if (wager.guildId) {
      const creatorStats = await ctx.db
        .query("userServerStats")
        .withIndex("by_userId_guildId", (q) =>
          q.eq("userId", user._id).eq("guildId", wager.guildId!)
        )
        .unique();

      if (creatorStats) {
        const penalty = Math.max(1, Math.floor(creatorStats.points * 0.1));
        await ctx.db.patch(creatorStats._id, {
          points: creatorStats.points - penalty,
          totalPointsLost: creatorStats.totalPointsLost + penalty,
        });
      }
    }

    return { success: true };
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

    // Settle all bets on this wager (includes creator cut from fail pool)
    await ctx.scheduler.runAfter(0, internal.bets.settleBets, {
      wagerId: args.wagerId,
      passed: args.passed,
    });

    // Award creator completion reward (variable by difficulty)
    if (wager.guildId) {
      const creatorStats = await ctx.db
        .query("userServerStats")
        .withIndex("by_userId_guildId", (q) =>
          q.eq("userId", user._id).eq("guildId", wager.guildId!)
        )
        .unique();

      if (creatorStats) {
        if (args.passed) {
          // Calculate variable reward based on deadline difficulty
          const deadline = wager.isMultiTask ? wager.finalDeadline : wager.deadline;
          const reward = getCompletionReward(deadline || wager.createdAt + 72 * 60 * 60 * 1000, wager.createdAt);

          await ctx.db.patch(creatorStats._id, {
            points: creatorStats.points + reward,
            totalPointsWon: creatorStats.totalPointsWon + reward,
          });
        } else {
          // Failure penalty: 10% of current points
          const penalty = Math.max(1, Math.floor(creatorStats.points * 0.1));
          await ctx.db.patch(creatorStats._id, {
            points: creatorStats.points - penalty,
            totalPointsLost: creatorStats.totalPointsLost + penalty,
          });
        }
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
          task: getWagerTask(wager),
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

// ═══════════════════════════════════════════════════════════════
// Storage File Management
// ═══════════════════════════════════════════════════════════════

// Delete a proof file from storage
export const deleteProofFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    await ctx.storage.delete(args.storageId);
  },
});

// Internal: Delete storage file (for cleanup operations)
export const deleteStorageFile = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    try {
      await ctx.storage.delete(args.storageId);
      return { success: true };
    } catch (error) {
      console.error("Failed to delete storage file:", args.storageId, error);
      return { success: false };
    }
  },
});

// Clean up orphaned storage files (files not linked to any wager or task)
export const cleanupOrphanedFiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all storage files
    const allFiles = await ctx.db.system.query("_storage").collect();

    // Get all used storage IDs from wagers
    const wagers = await ctx.db.query("wagers").collect();
    const usedIds = new Set<string>();

    for (const wager of wagers) {
      if (wager.proofStorageId) usedIds.add(wager.proofStorageId);
      if (wager.resultAudioStorageId) usedIds.add(wager.resultAudioStorageId);
    }

    // Get all used storage IDs from wager tasks
    const tasks = await ctx.db.query("wagerTasks").collect();
    for (const task of tasks) {
      if (task.proofStorageId) usedIds.add(task.proofStorageId);
    }

    // Find orphaned files (older than 1 hour to avoid deleting in-progress uploads)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of allFiles) {
      if (!usedIds.has(file._id) && file._creationTime < oneHourAgo) {
        try {
          await ctx.storage.delete(file._id);
          deletedCount++;
        } catch (error) {
          console.error("Failed to delete orphaned file:", file._id, error);
        }
      }
    }

    console.log(`Cleaned up ${deletedCount} orphaned storage files`);
    return deletedCount;
  },
});
