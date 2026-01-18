import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getWagerTask } from "./validators";

// Helper to compute user stats from their wagers
function computeUserStats(wagers: Array<{ status: string }>) {
  const totalWagers = wagers.length;
  const completedWagers = wagers.filter((w) => w.status === "completed").length;
  const failedWagers = wagers.filter((w) => w.status === "failed").length;

  return { totalWagers, completedWagers, failedWagers };
}

// Get server leaderboard
export const getServerLeaderboard = query({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all wagers in this server
    const serverWagers = await ctx.db
      .query("wagers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .collect();

    // Group wagers by userId
    const wagersByUser = new Map<string, typeof serverWagers>();
    for (const wager of serverWagers) {
      const userId = wager.userId.toString();
      if (!wagersByUser.has(userId)) {
        wagersByUser.set(userId, []);
      }
      wagersByUser.get(userId)!.push(wager);
    }

    // Get unique user IDs and fetch user data
    const userIds = [...new Set(serverWagers.map((w) => w.userId))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));

    // Compute stats for each user
    const usersWithStats = users
      .filter((u) => u !== null)
      .map((u) => {
        const userWagers = wagersByUser.get(u._id.toString()) || [];
        const stats = computeUserStats(userWagers);
        return { ...u, ...stats };
      });

    // Sort by completion rate (completed / total)
    const mostReliable = usersWithStats
      .filter((u) => u.totalWagers > 0)
      .sort((a, b) => {
        const rateA = a.completedWagers / a.totalWagers;
        const rateB = b.completedWagers / b.totalWagers;
        return rateB - rateA;
      })
      .slice(0, 5)
      .map((u) => ({
        discordId: u.discordId,
        discordUsername: u.discordUsername,
        completedWagers: u.completedWagers,
        totalWagers: u.totalWagers,
      }));

    // Most active (total wagers)
    const mostActive = usersWithStats
      .filter((u) => u.totalWagers > 0)
      .sort((a, b) => b.totalWagers - a.totalWagers)
      .slice(0, 5)
      .map((u) => ({
        discordId: u.discordId,
        discordUsername: u.discordUsername,
        totalWagers: u.totalWagers,
      }));

    return {
      mostReliable,
      mostActive,
    };
  },
});

// Get global leaderboard
export const getGlobalLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    // Get all wagers and group by user
    const allWagers = await ctx.db.query("wagers").collect();
    const wagersByUser = new Map<string, typeof allWagers>();
    for (const wager of allWagers) {
      const userId = wager.userId.toString();
      if (!wagersByUser.has(userId)) wagersByUser.set(userId, []);
      wagersByUser.get(userId)!.push(wager);
    }

    // Get all users
    const users = await ctx.db.query("users").collect();

    // Compute stats and sort by completed wagers
    const usersWithStats = users
      .map((u) => {
        const userWagers = wagersByUser.get(u._id.toString()) || [];
        const stats = computeUserStats(userWagers);
        return { ...u, ...stats };
      })
      .filter((u) => u.totalWagers > 0)
      .sort((a, b) => b.completedWagers - a.completedWagers)
      .slice(0, 10);

    return usersWithStats.map((u) => ({
      discordId: u.discordId,
      discordUsername: u.discordUsername,
      discordAvatarUrl: u.discordAvatarUrl,
      completedWagers: u.completedWagers,
      totalWagers: u.totalWagers,
    }));
  },
});

// Get full leaderboard data for the leaderboard page
export const getFullLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    // Get all wagers and group by user
    const allWagers = await ctx.db.query("wagers").collect();
    const wagersByUser = new Map<string, typeof allWagers>();
    for (const wager of allWagers) {
      const userId = wager.userId.toString();
      if (!wagersByUser.has(userId)) wagersByUser.set(userId, []);
      wagersByUser.get(userId)!.push(wager);
    }

    // Get all users
    const allUsers = await ctx.db.query("users").collect();

    // Compute stats for each user
    const usersWithStats = allUsers
      .map((u) => {
        const userWagers = wagersByUser.get(u._id.toString()) || [];
        const stats = computeUserStats(userWagers);
        return {
          id: u.discordId,
          name: u.discordUsername,
          avatar: u.discordAvatarUrl ?? null,
          ...stats,
          successRate: stats.totalWagers > 0
            ? Math.round((stats.completedWagers / stats.totalWagers) * 100)
            : 0,
        };
      })
      .filter((u) => u.totalWagers > 0);

    // Most reliable (by success rate)
    const mostReliable = [...usersWithStats]
      .sort((a, b) => {
        if (b.successRate !== a.successRate) return b.successRate - a.successRate;
        return b.completedWagers - a.completedWagers;
      })
      .slice(0, 20)
      .map((u, i) => ({ ...u, rank: i + 1 }));

    // Most active (by total wagers)
    const mostActive = [...usersWithStats]
      .sort((a, b) => b.totalWagers - a.totalWagers)
      .slice(0, 20)
      .map((u, i) => ({ ...u, rank: i + 1 }));

    // Hall of shame (low success rate)
    const hallOfShame = [...usersWithStats]
      .filter((u) => u.successRate < 75 && u.totalWagers >= 3)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 20)
      .map((u, i) => ({ ...u, rank: i + 1 }));

    // Global stats
    const totalUsers = usersWithStats.length;
    const totalWagers = usersWithStats.reduce((sum, u) => sum + u.totalWagers, 0);
    const totalCompleted = usersWithStats.reduce((sum, u) => sum + u.completedWagers, 0);
    const avgSuccessRate = totalWagers > 0
      ? Math.round((totalCompleted / totalWagers) * 100)
      : 0;

    return {
      mostReliable,
      mostActive,
      hallOfShame,
      stats: {
        totalUsers,
        totalWagers,
        avgSuccessRate,
      },
    };
  },
});

// Get weekly stats for a server
export const getWeeklyStats = query({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get start of current week (Monday 00:00 UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysFromMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekStartTimestamp = weekStart.getTime();

    // Get all wagers created this week in this server
    const weeklyWagers = await ctx.db
      .query("wagers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .filter((q) => q.gte(q.field("createdAt"), weekStartTimestamp))
      .collect();

    const completed = weeklyWagers.filter((w) => w.status === "completed").length;
    const failed = weeklyWagers.filter((w) => w.status === "failed").length;
    const active = weeklyWagers.filter((w) => w.status === "active").length;

    return {
      total: weeklyWagers.length,
      completed,
      failed,
      active,
      completionRate:
        completed + failed > 0
          ? Math.round((completed / (completed + failed)) * 100)
          : 0,
    };
  },
});

// Generate weekly leaderboard snapshot (called by cron)
export const generateWeeklySnapshot = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all servers
    const servers = await ctx.db.query("discordServers").collect();

    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - daysFromMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    for (const server of servers) {
      // Get all wagers for this week
      const weeklyWagers = await ctx.db
        .query("wagers")
        .withIndex("by_guildId", (q) => q.eq("guildId", server.guildId))
        .filter((q) =>
          q.and(
            q.gte(q.field("createdAt"), weekStart.getTime()),
            q.lte(q.field("createdAt"), weekEnd.getTime())
          )
        )
        .collect();

      // Find highest stakes wager (based on consequence length as proxy for severity)
      const completedWagers = weeklyWagers.filter((w) => w.status === "completed");
      const highestStakes = completedWagers.sort(
        (a, b) => b.consequence.length - a.consequence.length
      )[0];

      // Get user stats for this week
      const userIds = [...new Set(weeklyWagers.map((w) => w.userId))];
      const userStats = await Promise.all(
        userIds.map(async (userId) => {
          const user = await ctx.db.get(userId);
          const userWagers = weeklyWagers.filter((w) => w.userId === userId);
          const completed = userWagers.filter((w) => w.status === "completed").length;
          const total = userWagers.length;
          return { user, completed, total };
        })
      );

      // Most reliable this week
      const mostReliable = userStats
        .filter((s) => s.total > 0 && s.user)
        .sort((a, b) => b.completed / b.total - a.completed / a.total)[0];

      // Degen of the week (most wagers)
      const degenOfWeek = userStats
        .filter((s) => s.user)
        .sort((a, b) => b.total - a.total)[0];

      // Walk of shame (biggest fail)
      const failedWagers = weeklyWagers.filter((w) => w.status === "failed");
      const walkOfShame = failedWagers.sort(
        (a, b) => b.consequence.length - a.consequence.length
      )[0];

      // Create snapshot
      await ctx.db.insert("leaderboardSnapshots", {
        guildId: server.guildId,
        weekStart: weekStart.getTime(),
        weekEnd: weekEnd.getTime(),
        highestStakes: highestStakes
          ? {
              userId: highestStakes.userId,
              wagerId: highestStakes._id,
              consequence: highestStakes.consequence,
            }
          : undefined,
        mostReliable: mostReliable?.user
          ? {
              userId: mostReliable.user._id,
              completionRate: Math.round(
                (mostReliable.completed / mostReliable.total) * 100
              ),
              totalCompleted: mostReliable.completed,
            }
          : undefined,
        degenOfTheWeek: degenOfWeek?.user
          ? {
              userId: degenOfWeek.user._id,
              wagerCount: degenOfWeek.total,
            }
          : undefined,
        walkOfShame: walkOfShame
          ? {
              userId: walkOfShame.userId,
              wagerId: walkOfShame._id,
              task: getWagerTask(walkOfShame),
            }
          : undefined,
        createdAt: Date.now(),
      });
    }
  },
});
