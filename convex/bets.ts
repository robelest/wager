import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

// Get the start of the current week (Monday 00:00 UTC)
function getWeekStart(): number {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust for Monday start
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

// Get the end of the current week (Sunday 23:59:59 UTC)
function getWeekEnd(): number {
  const weekStart = getWeekStart();
  return weekStart + 7 * 24 * 60 * 60 * 1000 - 1;
}

// ═══════════════════════════════════════════════════════════════
// User Server Stats Management
// ═══════════════════════════════════════════════════════════════

// Get or create user server stats (internal helper)
async function getOrCreateUserServerStats(
  ctx: MutationCtx,
  userId: Id<"users">,
  guildId: string
): Promise<Doc<"userServerStats">> {
  // Try to find existing stats
  const existing = await ctx.db
    .query("userServerStats")
    .withIndex("by_userId_guildId", (q) =>
      q.eq("userId", userId).eq("guildId", guildId)
    )
    .unique();

  if (existing) {
    return existing;
  }

  // Create new stats with 100 starting points
  const statsId = await ctx.db.insert("userServerStats", {
    userId,
    guildId,
    points: 100,
    totalPointsWon: 0,
    totalPointsLost: 0,
    totalBets: 0,
    correctBets: 0,
  });

  const stats = await ctx.db.get(statsId);
  if (!stats) throw new Error("Failed to create user server stats");
  return stats;
}

// Check if user has created a wager this week in the server
async function hasWagerThisWeek(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  guildId: string
): Promise<boolean> {
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();

  const wager = await ctx.db
    .query("wagers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) =>
      q.and(
        q.eq(q.field("guildId"), guildId),
        q.gte(q.field("createdAt"), weekStart),
        q.lte(q.field("createdAt"), weekEnd)
      )
    )
    .first();

  return wager !== null;
}

// ═══════════════════════════════════════════════════════════════
// Betting Mutations
// ═══════════════════════════════════════════════════════════════

// Place a bet on a wager outcome
export const placeBet = mutation({
  args: {
    wagerId: v.string(),
    oddsmakerDiscordId: v.string(),
    oddsmakerUsername: v.string(),
    prediction: v.union(v.literal("success"), v.literal("fail")),
    pointsWagered: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const wagerId = args.wagerId as Id<"wagers">;

    // Validate points amount
    if (args.pointsWagered < 10) {
      throw new Error("Minimum bet is 10 points");
    }

    // Check if wager exists and is active
    const wager = await ctx.db.get(wagerId);
    if (!wager || wager.status !== "active") {
      throw new Error("Wager not found or not active");
    }

    if (!wager.guildId) {
      throw new Error("Wager has no associated server");
    }

    // Find the bettor's user record
    const bettor = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.oddsmakerDiscordId))
      .unique();

    if (!bettor) {
      throw new Error("You need to create a wager first to start betting");
    }

    // Check eligibility: must have created a wager this week
    const hasWager = await hasWagerThisWeek(ctx, bettor._id, wager.guildId);
    if (!hasWager) {
      throw new Error(
        "Create a wager this week to unlock betting! You need skin in the game."
      );
    }

    // Can't bet on your own wager
    if (bettor._id === wager.userId) {
      throw new Error("You can't bet on your own wager");
    }

    // Check if user already bet on this wager
    const existingBet = await ctx.db
      .query("bets")
      .withIndex("by_wagerId", (q) => q.eq("wagerId", wagerId))
      .filter((q) =>
        q.eq(q.field("oddsmakerDiscordId"), args.oddsmakerDiscordId)
      )
      .first();

    if (existingBet) {
      throw new Error("You already placed a bet on this wager");
    }

    // Get/create user's server stats
    const stats = await getOrCreateUserServerStats(ctx, bettor._id, wager.guildId);

    // Validate user has enough points
    if (stats.points < args.pointsWagered) {
      throw new Error(
        `Not enough points! You have ${stats.points} points but tried to bet ${args.pointsWagered}`
      );
    }

    // Deduct points from user
    await ctx.db.patch(stats._id, {
      points: stats.points - args.pointsWagered,
      totalBets: stats.totalBets + 1,
    });

    // Create the bet
    const betId = await ctx.db.insert("bets", {
      wagerId,
      oddsmakerDiscordId: args.oddsmakerDiscordId,
      oddsmakerUsername: args.oddsmakerUsername,
      prediction: args.prediction,
      pointsWagered: args.pointsWagered,
      settled: false,
      comment: args.comment,
      createdAt: Date.now(),
    });

    return {
      betId,
      pointsDeducted: args.pointsWagered,
      remainingPoints: stats.points - args.pointsWagered,
    };
  },
});

// Settle all bets for a completed wager (internal)
export const settleBets = internalMutation({
  args: {
    wagerId: v.id("wagers"),
    passed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const wager = await ctx.db.get(args.wagerId);
    if (!wager || !wager.guildId) return;

    // Get all unsettled bets for this wager
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_wagerId", (q) => q.eq("wagerId", args.wagerId))
      .filter((q) => q.eq(q.field("settled"), false))
      .collect();

    if (bets.length === 0) return;

    // Calculate pools
    const winningPrediction = args.passed ? "success" : "fail";
    const totalPool = bets.reduce((sum, bet) => sum + bet.pointsWagered, 0);
    const winningBets = bets.filter((b) => b.prediction === winningPrediction);
    const winningPool = winningBets.reduce(
      (sum, bet) => sum + bet.pointsWagered,
      0
    );

    // Process each bet
    for (const bet of bets) {
      const isWinner = bet.prediction === winningPrediction;
      let payout = 0;

      if (isWinner && winningPool > 0) {
        // Winners split the total pool proportionally
        payout = Math.floor((bet.pointsWagered / winningPool) * totalPool);
      }

      // Update bet record
      await ctx.db.patch(bet._id, {
        settled: true,
        payout,
      });

      // Find the bettor's user record
      const bettor = await ctx.db
        .query("users")
        .withIndex("by_discordId", (q) =>
          q.eq("discordId", bet.oddsmakerDiscordId)
        )
        .unique();

      if (!bettor) continue;

      // Get their server stats
      const stats = await ctx.db
        .query("userServerStats")
        .withIndex("by_userId_guildId", (q) =>
          q.eq("userId", bettor._id).eq("guildId", wager.guildId!)
        )
        .unique();

      if (!stats) continue;

      // Update stats based on outcome
      if (isWinner) {
        const profit = payout - bet.pointsWagered;
        await ctx.db.patch(stats._id, {
          points: stats.points + payout,
          totalPointsWon: stats.totalPointsWon + profit,
          correctBets: stats.correctBets + 1,
        });
      } else {
        await ctx.db.patch(stats._id, {
          totalPointsLost: stats.totalPointsLost + bet.pointsWagered,
        });
      }
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

// Get all bets for a wager
export const getBetsForWager = query({
  args: {
    wagerId: v.id("wagers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_wagerId", (q) => q.eq("wagerId", args.wagerId))
      .collect();
  },
});

// Get bet stats for a wager (with pool totals)
export const getBetStats = query({
  args: {
    wagerId: v.id("wagers"),
  },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_wagerId", (q) => q.eq("wagerId", args.wagerId))
      .collect();

    const successBets = bets.filter((b) => b.prediction === "success");
    const failBets = bets.filter((b) => b.prediction === "fail");

    const successPool = successBets.reduce((sum, b) => sum + b.pointsWagered, 0);
    const failPool = failBets.reduce((sum, b) => sum + b.pointsWagered, 0);
    const totalPool = successPool + failPool;

    return {
      total: bets.length,
      successCount: successBets.length,
      failCount: failBets.length,
      successPool,
      failPool,
      totalPool,
      successPercentage:
        bets.length > 0 ? Math.round((successBets.length / bets.length) * 100) : 0,
    };
  },
});

// Get user's points for a specific server
export const getUserServerPoints = query({
  args: {
    discordId: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (!user) {
      return { points: 0, hasAccount: false };
    }

    const stats = await ctx.db
      .query("userServerStats")
      .withIndex("by_userId_guildId", (q) =>
        q.eq("userId", user._id).eq("guildId", args.guildId)
      )
      .unique();

    if (!stats) {
      return { points: 100, hasAccount: true, isNew: true };
    }

    return {
      points: stats.points,
      totalPointsWon: stats.totalPointsWon,
      totalPointsLost: stats.totalPointsLost,
      totalBets: stats.totalBets,
      correctBets: stats.correctBets,
      hasAccount: true,
      isNew: false,
    };
  },
});

// Get all server points for a user (for web app)
export const getUserAllServerPoints = query({
  args: {
    discordId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (!user) {
      return [];
    }

    const allStats = await ctx.db
      .query("userServerStats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Get server names
    const results = await Promise.all(
      allStats.map(async (stats) => {
        const server = await ctx.db
          .query("discordServers")
          .withIndex("by_guildId", (q) => q.eq("guildId", stats.guildId))
          .unique();

        return {
          guildId: stats.guildId,
          guildName: server?.guildName || "Unknown Server",
          points: stats.points,
          totalPointsWon: stats.totalPointsWon,
          totalPointsLost: stats.totalPointsLost,
          totalBets: stats.totalBets,
          correctBets: stats.correctBets,
        };
      })
    );

    return results;
  },
});

// Get betting leaderboard for a server
export const getServerBettingLeaderboard = query({
  args: {
    guildId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const allStats = await ctx.db
      .query("userServerStats")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .collect();

    // Sort by points descending
    const sorted = allStats.sort((a, b) => b.points - a.points).slice(0, limit);

    // Get user details
    const results = await Promise.all(
      sorted.map(async (stats, index) => {
        const user = await ctx.db.get(stats.userId);
        return {
          rank: index + 1,
          discordId: user?.discordId || "",
          username: user?.discordUsername || "Unknown",
          displayName: user?.discordDisplayName,
          avatarUrl: user?.discordAvatarUrl,
          points: stats.points,
          totalPointsWon: stats.totalPointsWon,
          totalBets: stats.totalBets,
          correctBets: stats.correctBets,
          winRate:
            stats.totalBets > 0
              ? Math.round((stats.correctBets / stats.totalBets) * 100)
              : 0,
        };
      })
    );

    return results;
  },
});

// Check if user can bet (has wager this week)
export const canUserBet = query({
  args: {
    discordId: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (!user) {
      return { canBet: false, reason: "No account found. Create a wager first!" };
    }

    const hasWager = await hasWagerThisWeek(ctx, user._id, args.guildId);

    if (!hasWager) {
      return {
        canBet: false,
        reason: "Create a wager this week to unlock betting!",
      };
    }

    return { canBet: true };
  },
});

// Internal query to get bets for settlement
export const getBetsForSettlement = internalQuery({
  args: {
    wagerId: v.id("wagers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_wagerId", (q) => q.eq("wagerId", args.wagerId))
      .filter((q) => q.eq(q.field("settled"), false))
      .collect();
  },
});
