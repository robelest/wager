import type { Infer } from "convex/values";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════
// STATUS ENUMS - Reusable across tables
// ═══════════════════════════════════════════════════════════════

export const wagerStatus = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled")
);
export type WagerStatus = Infer<typeof wagerStatus>;

export const taskStatus = v.union(
  v.literal("pending"),
  v.literal("submitted"),
  v.literal("verified"),
  v.literal("failed"),
  v.literal("rejected")
);
export type TaskStatus = Infer<typeof taskStatus>;

export const parlayStatus = v.union(
  v.literal("pending"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("cancelled"),
  v.literal("void")
);
export type ParlayStatus = Infer<typeof parlayStatus>;

export const legStatus = v.union(
  v.literal("pending"),
  v.literal("correct"),
  v.literal("incorrect"),
  v.literal("cancelled")
);
export type LegStatus = Infer<typeof legStatus>;

export const prediction = v.union(v.literal("success"), v.literal("fail"));
export type Prediction = Infer<typeof prediction>;

// ═══════════════════════════════════════════════════════════════
// COMMON VALIDATORS - Reusable field patterns
// ═══════════════════════════════════════════════════════════════

export const verificationResult = v.object({
  passed: v.boolean(),
  confidence: v.number(),
  reasoning: v.string(),
});
export type VerificationResult = Infer<typeof verificationResult>;

export const verificationResultWithTimestamp = v.object({
  passed: v.boolean(),
  confidence: v.number(),
  reasoning: v.string(),
  verifiedAt: v.number(),
});
export type VerificationResultWithTimestamp = Infer<
  typeof verificationResultWithTimestamp
>;

export const oddsSnapshot = v.object({
  successPool: v.number(),
  failPool: v.number(),
});
export type OddsSnapshot = Infer<typeof oddsSnapshot>;

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD VALIDATORS - Category snapshots
// ═══════════════════════════════════════════════════════════════

export const highestStakesWinner = v.object({
  userId: v.id("users"),
  wagerId: v.id("wagers"),
  consequence: v.string(),
  trophyImageStorageId: v.optional(v.id("_storage")),
  messageId: v.optional(v.string()),
});

export const mostReliableWinner = v.object({
  userId: v.id("users"),
  completionRate: v.number(),
  totalCompleted: v.number(),
  trophyImageStorageId: v.optional(v.id("_storage")),
  messageId: v.optional(v.string()),
});

export const degenOfTheWeekWinner = v.object({
  userId: v.id("users"),
  wagerCount: v.number(),
  trophyImageStorageId: v.optional(v.id("_storage")),
  messageId: v.optional(v.string()),
});

export const walkOfShameWinner = v.object({
  userId: v.id("users"),
  wagerId: v.id("wagers"),
  task: v.string(),
  trophyImageStorageId: v.optional(v.id("_storage")),
  messageId: v.optional(v.string()),
});

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS - Type-safe accessors for wager fields
// ═══════════════════════════════════════════════════════════════

/** Get display task for a wager (handles multi-task vs single-task) */
export function getWagerTask(wager: {
  task?: string | null;
  wagerTitle?: string | null;
}): string {
  return wager.task || wager.wagerTitle || "Unknown task";
}

/** Get deadline for a wager (handles multi-task vs single-task) */
export function getWagerDeadline(wager: {
  deadline?: number | null;
  finalDeadline?: number | null;
}): number {
  return wager.deadline || wager.finalDeadline || Date.now();
}

/** Check if a wager is multi-task */
export function isMultiTaskWager(wager: {
  isMultiTask?: boolean | null;
}): boolean {
  return wager.isMultiTask === true;
}
