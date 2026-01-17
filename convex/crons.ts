import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ═══════════════════════════════════════════════════════════════
// DEADLINE CHECKER - Every hour
// Check for wagers that have passed their deadline without proof
// ═══════════════════════════════════════════════════════════════
crons.interval(
  "check for expired wagers",
  { hours: 1 },
  internal.wagers.checkExpiredWagers
);

// ═══════════════════════════════════════════════════════════════
// WEEKLY LEADERBOARD - Monday 00:00 UTC
// Generate weekly leaderboard snapshots for all servers
// (Runs at start of new week to capture full previous week)
// ═══════════════════════════════════════════════════════════════
crons.weekly(
  "generate weekly leaderboard",
  { dayOfWeek: "monday", hourUTC: 0, minuteUTC: 0 },
  internal.leaderboard.generateWeeklySnapshot
);

export default crons;
