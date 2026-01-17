import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get server leaderboard
export const getServerLeaderboard = query({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all users who have wagers in this server
    const serverWagers = await ctx.db
      .query("wagers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .collect();

    // Get unique user IDs
    const userIds = [...new Set(serverWagers.map((w) => w.userId))];

    // Fetch user data
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get(id))
    );

    const validUsers = users.filter((u) => u !== null);

    // Sort by completion rate (completed / total)
    const mostReliable = validUsers
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

    // Sort by longest streak
    const longestStreak = validUsers
      .filter((u) => u.longestStreak > 0)
      .sort((a, b) => b.longestStreak - a.longestStreak)
      .slice(0, 5)
      .map((u) => ({
        discordId: u.discordId,
        discordUsername: u.discordUsername,
        longestStreak: u.longestStreak,
      }));

    // Sort by current streak
    const currentStreak = validUsers
      .filter((u) => u.currentStreak > 0)
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 5)
      .map((u) => ({
        discordId: u.discordId,
        discordUsername: u.discordUsername,
        currentStreak: u.currentStreak,
      }));

    // Most active (total wagers)
    const mostActive = validUsers
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
      longestStreak,
      currentStreak,
      mostActive,
    };
  },
});

// Get global leaderboard
export const getGlobalLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    // Get all users sorted by completed wagers
    const users = await ctx.db
      .query("users")
      .withIndex("by_completedWagers")
      .order("desc")
      .take(10);

    return users.map((u) => ({
      discordId: u.discordId,
      discordUsername: u.discordUsername,
      discordAvatarUrl: u.discordAvatarUrl,
      completedWagers: u.completedWagers,
      totalWagers: u.totalWagers,
      currentStreak: u.currentStreak,
      longestStreak: u.longestStreak,
    }));
  },
});

// Get full leaderboard data for the leaderboard page
export const getFullLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    // Get all users with at least one wager
    const allUsers = await ctx.db
      .query("users")
      .filter((q) => q.gt(q.field("totalWagers"), 0))
      .collect();

    // Map to consistent format with calculated success rate
    const usersWithStats = allUsers.map((u) => ({
      id: u.discordId,
      name: u.discordUsername,
      avatar: u.discordAvatarUrl ?? null,
      completedWagers: u.completedWagers,
      totalWagers: u.totalWagers,
      currentStreak: u.currentStreak,
      longestStreak: u.longestStreak,
      successRate: u.totalWagers > 0
        ? Math.round((u.completedWagers / u.totalWagers) * 100)
        : 0,
    }));

    // Most reliable (by success rate)
    const mostReliable = [...usersWithStats]
      .sort((a, b) => {
        // Sort by success rate, then by completed wagers as tiebreaker
        if (b.successRate !== a.successRate) return b.successRate - a.successRate;
        return b.completedWagers - a.completedWagers;
      })
      .slice(0, 20)
      .map((u, i) => ({ ...u, rank: i + 1 }));

    // Longest current streak
    const byStreak = [...usersWithStats]
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 20)
      .map((u, i) => ({ ...u, rank: i + 1 }));

    // Most active (by total wagers)
    const mostActive = [...usersWithStats]
      .sort((a, b) => b.totalWagers - a.totalWagers)
      .slice(0, 20)
      .map((u, i) => ({ ...u, rank: i + 1 }));

    // Hall of shame (low success rate or broken streak)
    const hallOfShame = [...usersWithStats]
      .filter((u) => u.successRate < 75 || (u.currentStreak === 0 && u.totalWagers >= 3))
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 20)
      .map((u, i) => ({ ...u, rank: i + 1 }));

    // Global stats
    const totalUsers = allUsers.length;
    const totalWagers = allUsers.reduce((sum, u) => sum + u.totalWagers, 0);
    const totalCompleted = allUsers.reduce((sum, u) => sum + u.completedWagers, 0);
    const activeStreaks = allUsers.filter((u) => u.currentStreak > 0).length;
    const avgSuccessRate = totalWagers > 0
      ? Math.round((totalCompleted / totalWagers) * 100)
      : 0;

    return {
      mostReliable,
      byStreak,
      mostActive,
      hallOfShame,
      stats: {
        totalUsers,
        totalWagers,
        avgSuccessRate,
        activeStreaks,
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
              task: walkOfShame.task,
            }
          : undefined,
        createdAt: Date.now(),
      });
    }
  },
});
