import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  wagerStatus,
  taskStatus,
  parlayStatus,
  legStatus,
  prediction,
  verificationResult,
  verificationResultWithTimestamp,
  oddsSnapshot,
  highestStakesWinner,
  mostReliableWinner,
  degenOfTheWeekWinner,
  walkOfShameWinner,
} from "./validators";

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
    // Stats are computed on-the-fly from wagers table
  })
    .index("by_betterAuthUserId", ["betterAuthUserId"])
    .index("by_discordId", ["discordId"])
    .index("by_discordUsername", ["discordUsername"]),

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
    // Gateway sync fields
    isActive: v.optional(v.boolean()), // false if bot was kicked from server
    lastSyncedAt: v.optional(v.number()), // Last time synced via Gateway bot
  }).index("by_guildId", ["guildId"]),

  // ═══════════════════════════════════════════════════════════════
  // WAGERS - The core accountability commitments
  // ═══════════════════════════════════════════════════════════════
  wagers: defineTable({
    userId: v.id("users"),
    guildId: v.optional(v.string()), // Discord server where wager was created
    // The commitment (for single-task wagers)
    task: v.optional(v.string()), // "Ship landing page by Friday" (optional for multi-task)
    consequence: v.string(), // "100 burpees on camera"
    deadline: v.optional(v.number()), // Unix timestamp (optional for multi-task)
    // Multi-task wager fields
    isMultiTask: v.optional(v.boolean()),
    wagerTitle: v.optional(v.string()), // "Read 5 books" (title for multi-task wagers)
    taskCount: v.optional(v.number()), // Denormalized count
    completedTaskCount: v.optional(v.number()), // Denormalized progress
    finalDeadline: v.optional(v.number()), // Latest task deadline
    // Status tracking
    status: wagerStatus,
    // Discord integration
    commitmentMessageId: v.optional(v.string()), // Discord message ID
    commitmentChannelId: v.optional(v.string()), // Channel where commitment was posted
    resultMessageId: v.optional(v.string()), // Result announcement message
    // Proof & verification (for single-task wagers)
    proofImageUrl: v.optional(v.string()),
    proofMessageId: v.optional(v.string()), // Discord message with proof
    proofStorageId: v.optional(v.id("_storage")),
    verificationResult: v.optional(verificationResult),
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
  // WAGER TASKS - Individual tasks within multi-task wagers
  // ═══════════════════════════════════════════════════════════════
  wagerTasks: defineTable({
    wagerId: v.id("wagers"),
    description: v.string(), // "Read book 1"
    taskIndex: v.number(), // Order within wager (0, 1, 2...)
    deadline: v.number(), // Per-task deadline
    // Status tracking
    status: taskStatus,
    // Proof & verification (per task)
    proofImageUrl: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    proofMessageId: v.optional(v.string()),
    proofSubmittedAt: v.optional(v.number()),
    verificationResult: v.optional(verificationResultWithTimestamp),
  })
    .index("by_wagerId", ["wagerId"])
    .index("by_wagerId_taskIndex", ["wagerId", "taskIndex"])
    .index("by_status", ["status"])
    .index("by_deadline", ["deadline"])
    .index("by_deadline_status", ["deadline", "status"]),

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
    prediction: prediction,
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
  // PARLAY BETS - Combined predictions across multiple wagers
  // ═══════════════════════════════════════════════════════════════
  parlayBets: defineTable({
    oddsmakerDiscordId: v.string(),
    oddsmakerUsername: v.string(),
    guildId: v.string(),
    pointsWagered: v.number(),
    // Status tracking
    status: parlayStatus,
    // Payout
    potentialPayout: v.number(), // Calculated at creation
    actualPayout: v.optional(v.number()), // Set at settlement
    settled: v.boolean(),
    settledAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_oddsmaker", ["oddsmakerDiscordId"])
    .index("by_guildId", ["guildId"])
    .index("by_status", ["status"])
    .index("by_settled", ["settled"]),

  // ═══════════════════════════════════════════════════════════════
  // PARLAY LEGS - Individual predictions within a parlay
  // ═══════════════════════════════════════════════════════════════
  parlayLegs: defineTable({
    parlayId: v.id("parlayBets"),
    wagerId: v.id("wagers"),
    prediction: prediction,
    // Status tracking per leg
    status: legStatus,
    // Odds snapshot at time of parlay creation
    oddsAtCreation: v.optional(oddsSnapshot),
  })
    .index("by_parlayId", ["parlayId"])
    .index("by_wagerId", ["wagerId"]),

  // ═══════════════════════════════════════════════════════════════
  // POINT REWARDS - Server-issued rewards from admins
  // ═══════════════════════════════════════════════════════════════
  pointRewards: defineTable({
    guildId: v.string(),
    recipientDiscordId: v.string(),
    recipientUsername: v.string(),
    amount: v.number(), // Can be positive (reward) or negative (penalty)
    reason: v.string(),
    issuedByDiscordId: v.string(), // Admin who issued the reward
    issuedByUsername: v.string(),
    createdAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_recipient", ["recipientDiscordId"])
    .index("by_guildId_recipient", ["guildId", "recipientDiscordId"]),

  // ═══════════════════════════════════════════════════════════════
  // WEEKLY LEADERBOARD SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════
  leaderboardSnapshots: defineTable({
    guildId: v.optional(v.string()), // Per-server leaderboards
    weekStart: v.number(), // Monday 00:00 UTC timestamp
    weekEnd: v.number(), // Sunday 23:59 UTC timestamp
    // Category winners
    highestStakes: v.optional(highestStakesWinner),
    mostReliable: v.optional(mostReliableWinner),
    degenOfTheWeek: v.optional(degenOfTheWeekWinner),
    walkOfShame: v.optional(walkOfShameWinner),
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
