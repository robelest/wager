import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ═══════════════════════════════════════════════════════════════
  // USERS - Extended profile data beyond Better Auth
  // ═══════════════════════════════════════════════════════════════
  users: defineTable({
    // Better Auth manages core user data, we store Discord-specific fields
    betterAuthUserId: v.string(),
    discordId: v.string(),
    discordUsername: v.string(),
    discordDisplayName: v.optional(v.string()),
    discordAvatarUrl: v.optional(v.string()),
    // Stats (denormalized for leaderboard performance)
    totalWagers: v.number(),
    completedWagers: v.number(),
    failedWagers: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
  })
    .index("by_betterAuthUserId", ["betterAuthUserId"])
    .index("by_discordId", ["discordId"])
    .index("by_discordUsername", ["discordUsername"])
    .index("by_completedWagers", ["completedWagers"]),

  // ═══════════════════════════════════════════════════════════════
  // DISCORD SERVERS - Track which servers the bot is in
  // ═══════════════════════════════════════════════════════════════
  discordServers: defineTable({
    guildId: v.string(), // Discord server ID
    guildName: v.string(),
    wagersChannelId: v.optional(v.string()), // Channel for posting wagers
    proofChannelId: v.optional(v.string()), // Channel for proof submissions
    leaderboardChannelId: v.optional(v.string()), // Channel for weekly leaderboards
    announcementsChannelId: v.optional(v.string()), // Channel for results
    addedAt: v.number(),
  }).index("by_guildId", ["guildId"]),

  // ═══════════════════════════════════════════════════════════════
  // WAGERS - The core accountability commitments
  // ═══════════════════════════════════════════════════════════════
  wagers: defineTable({
    userId: v.id("users"),
    guildId: v.optional(v.string()), // Discord server where wager was created
    // The commitment
    task: v.string(), // "Ship landing page by Friday"
    consequence: v.string(), // "100 burpees on camera"
    deadline: v.number(), // Unix timestamp
    // Status tracking
    status: v.union(
      v.literal("pending"), // Created, not yet posted
      v.literal("active"), // Posted to Discord, monitoring for proof
      v.literal("completed"), // Proof verified, success!
      v.literal("failed"), // Deadline passed, no valid proof
      v.literal("cancelled") // User cancelled before deadline
    ),
    // Discord integration
    commitmentMessageId: v.optional(v.string()), // Discord message ID
    commitmentChannelId: v.optional(v.string()), // Channel where commitment was posted
    resultMessageId: v.optional(v.string()), // Result announcement message
    // Proof & verification
    proofImageUrl: v.optional(v.string()),
    proofMessageId: v.optional(v.string()), // Discord message with proof
    proofStorageId: v.optional(v.id("_storage")),
    verificationResult: v.optional(
      v.object({
        passed: v.boolean(),
        confidence: v.number(),
        reasoning: v.string(),
      })
    ),
    // Audio result
    resultAudioStorageId: v.optional(v.id("_storage")),
    resultAudioUrl: v.optional(v.string()),
    // Metadata
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_deadline", ["deadline"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_guildId", ["guildId"]),

  // ═══════════════════════════════════════════════════════════════
  // USER SERVER STATS - Per-server points and betting stats
  // ═══════════════════════════════════════════════════════════════
  userServerStats: defineTable({
    userId: v.id("users"),
    guildId: v.string(),
    // Points
    points: v.number(), // Current point balance (starts at 100)
    totalPointsWon: v.number(), // Lifetime winnings
    totalPointsLost: v.number(), // Lifetime losses
    // Betting stats
    totalBets: v.number(),
    correctBets: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_guildId", ["guildId"])
    .index("by_userId_guildId", ["userId", "guildId"])
    .index("by_guildId_points", ["guildId", "points"]),

  // ═══════════════════════════════════════════════════════════════
  // SOCIAL BETS - Others betting on wager outcomes (via reactions)
  // ═══════════════════════════════════════════════════════════════
  bets: defineTable({
    wagerId: v.id("wagers"),
    oddsmakerDiscordId: v.string(), // Discord ID of person betting
    oddsmakerUsername: v.string(),
    prediction: v.union(v.literal("success"), v.literal("fail")),
    comment: v.optional(v.string()), // Optional trash talk
    // Points system
    pointsWagered: v.number(), // How many points bet
    settled: v.boolean(), // Has this bet been paid out?
    payout: v.optional(v.number()), // Points won (0 if lost)
    createdAt: v.number(),
  })
    .index("by_wagerId", ["wagerId"])
    .index("by_oddsmaker", ["oddsmakerDiscordId"]),

  // ═══════════════════════════════════════════════════════════════
  // WEEKLY LEADERBOARD SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════
  leaderboardSnapshots: defineTable({
    guildId: v.optional(v.string()), // Per-server leaderboards
    weekStart: v.number(), // Monday 00:00 UTC timestamp
    weekEnd: v.number(), // Sunday 23:59 UTC timestamp
    // Category winners
    highestStakes: v.optional(
      v.object({
        userId: v.id("users"),
        wagerId: v.id("wagers"),
        consequence: v.string(),
        trophyImageStorageId: v.optional(v.id("_storage")),
        messageId: v.optional(v.string()),
      })
    ),
    mostReliable: v.optional(
      v.object({
        userId: v.id("users"),
        completionRate: v.number(),
        totalCompleted: v.number(),
        trophyImageStorageId: v.optional(v.id("_storage")),
        messageId: v.optional(v.string()),
      })
    ),
    degenOfTheWeek: v.optional(
      v.object({
        userId: v.id("users"),
        wagerCount: v.number(),
        trophyImageStorageId: v.optional(v.id("_storage")),
        messageId: v.optional(v.string()),
      })
    ),
    walkOfShame: v.optional(
      v.object({
        userId: v.id("users"),
        wagerId: v.id("wagers"),
        task: v.string(),
        trophyImageStorageId: v.optional(v.id("_storage")),
        messageId: v.optional(v.string()),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_weekStart", ["weekStart"])
    .index("by_guildId_weekStart", ["guildId", "weekStart"]),

  // ═══════════════════════════════════════════════════════════════
  // MONITORING LOGS - For debugging/transparency
  // ═══════════════════════════════════════════════════════════════
  monitoringLogs: defineTable({
    wagerId: v.id("wagers"),
    checkedAt: v.number(),
    foundMessages: v.number(),
    foundImages: v.number(),
    proofCandidates: v.array(
      v.object({
        messageId: v.string(),
        imageUrl: v.string(),
        confidence: v.number(),
      })
    ),
  }).index("by_wagerId", ["wagerId"]),
});
