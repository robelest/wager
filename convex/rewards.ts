import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// Server Admin Reward Commands
// ═══════════════════════════════════════════════════════════════

// Issue a reward to a user (called from Discord bot)
export const issueReward = mutation({
  args: {
    guildId: v.string(),
    recipientDiscordId: v.string(),
    recipientUsername: v.string(),
    amount: v.number(), // Can be positive (reward) or negative (penalty)
    reason: v.string(),
    issuedByDiscordId: v.string(),
    issuedByUsername: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate amount
    if (args.amount === 0) {
      throw new Error("Reward amount cannot be zero");
    }

    // Find the recipient's user record
    const recipient = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.recipientDiscordId))
      .unique();

    if (!recipient) {
      throw new Error("User not found. They need to create a wager first.");
    }

    // Get or create their server stats
    let stats = await ctx.db
      .query("userServerStats")
      .withIndex("by_userId_guildId", (q) =>
        q.eq("userId", recipient._id).eq("guildId", args.guildId)
      )
      .unique();

    if (!stats) {
      // Create server stats with starting balance
      const statsId = await ctx.db.insert("userServerStats", {
        userId: recipient._id,
        guildId: args.guildId,
        points: 100, // Starting balance
        totalPointsWon: 0,
        totalPointsLost: 0,
        totalBets: 0,
        correctBets: 0,
      });
      stats = await ctx.db.get(statsId);
      if (!stats) throw new Error("Failed to create user stats");
    }

    // Apply the reward/penalty
    const newPoints = Math.max(0, stats.points + args.amount);

    await ctx.db.patch(stats._id, {
      points: newPoints,
      totalPointsWon: args.amount > 0 ? stats.totalPointsWon + args.amount : stats.totalPointsWon,
      totalPointsLost: args.amount < 0 ? stats.totalPointsLost + Math.abs(args.amount) : stats.totalPointsLost,
    });

    // Log the reward
    await ctx.db.insert("pointRewards", {
      guildId: args.guildId,
      recipientDiscordId: args.recipientDiscordId,
      recipientUsername: args.recipientUsername,
      amount: args.amount,
      reason: args.reason,
      issuedByDiscordId: args.issuedByDiscordId,
      issuedByUsername: args.issuedByUsername,
      createdAt: Date.now(),
    });

    return {
      previousPoints: stats.points,
      newPoints,
      amount: args.amount,
    };
  },
});

// Issue rewards to multiple users (bulk reward)
export const issueBulkReward = mutation({
  args: {
    guildId: v.string(),
    recipients: v.array(
      v.object({
        discordId: v.string(),
        username: v.string(),
      })
    ),
    amount: v.number(),
    reason: v.string(),
    issuedByDiscordId: v.string(),
    issuedByUsername: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.amount === 0) {
      throw new Error("Reward amount cannot be zero");
    }

    if (args.recipients.length === 0) {
      throw new Error("No recipients specified");
    }

    if (args.recipients.length > 50) {
      throw new Error("Maximum 50 recipients per bulk reward");
    }

    const results: Array<{
      discordId: string;
      username: string;
      success: boolean;
      newPoints?: number;
      error?: string;
    }> = [];

    for (const recipient of args.recipients) {
      try {
        // Find the recipient's user record
        const user = await ctx.db
          .query("users")
          .withIndex("by_discordId", (q) => q.eq("discordId", recipient.discordId))
          .unique();

        if (!user) {
          results.push({
            discordId: recipient.discordId,
            username: recipient.username,
            success: false,
            error: "User not found",
          });
          continue;
        }

        // Get or create their server stats
        let stats = await ctx.db
          .query("userServerStats")
          .withIndex("by_userId_guildId", (q) =>
            q.eq("userId", user._id).eq("guildId", args.guildId)
          )
          .unique();

        if (!stats) {
          const statsId = await ctx.db.insert("userServerStats", {
            userId: user._id,
            guildId: args.guildId,
            points: 100,
            totalPointsWon: 0,
            totalPointsLost: 0,
            totalBets: 0,
            correctBets: 0,
          });
          stats = await ctx.db.get(statsId);
          if (!stats) {
            results.push({
              discordId: recipient.discordId,
              username: recipient.username,
              success: false,
              error: "Failed to create stats",
            });
            continue;
          }
        }

        // Apply the reward
        const newPoints = Math.max(0, stats.points + args.amount);

        await ctx.db.patch(stats._id, {
          points: newPoints,
          totalPointsWon: args.amount > 0 ? stats.totalPointsWon + args.amount : stats.totalPointsWon,
          totalPointsLost: args.amount < 0 ? stats.totalPointsLost + Math.abs(args.amount) : stats.totalPointsLost,
        });

        // Log the reward
        await ctx.db.insert("pointRewards", {
          guildId: args.guildId,
          recipientDiscordId: recipient.discordId,
          recipientUsername: recipient.username,
          amount: args.amount,
          reason: args.reason,
          issuedByDiscordId: args.issuedByDiscordId,
          issuedByUsername: args.issuedByUsername,
          createdAt: Date.now(),
        });

        results.push({
          discordId: recipient.discordId,
          username: recipient.username,
          success: true,
          newPoints,
        });
      } catch (error) {
        results.push({
          discordId: recipient.discordId,
          username: recipient.username,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      totalRecipients: args.recipients.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

// Get reward history for a server
export const getServerRewardHistory = query({
  args: {
    guildId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const rewards = await ctx.db
      .query("pointRewards")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .order("desc")
      .take(limit);

    return rewards;
  },
});

// Get reward history for a specific user in a server
export const getUserRewardHistory = query({
  args: {
    guildId: v.string(),
    discordId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    const rewards = await ctx.db
      .query("pointRewards")
      .withIndex("by_guildId_recipient", (q) =>
        q.eq("guildId", args.guildId).eq("recipientDiscordId", args.discordId)
      )
      .order("desc")
      .take(limit);

    return rewards;
  },
});

// Get total rewards issued in a server
export const getServerRewardStats = query({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const rewards = await ctx.db
      .query("pointRewards")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .collect();

    const totalPositive = rewards
      .filter((r) => r.amount > 0)
      .reduce((sum, r) => sum + r.amount, 0);

    const totalNegative = rewards
      .filter((r) => r.amount < 0)
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);

    return {
      totalRewardsIssued: rewards.length,
      totalPointsAwarded: totalPositive,
      totalPointsDeducted: totalNegative,
      netPointsIssued: totalPositive - totalNegative,
    };
  },
});
