import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════
// Parlay Creation
// ═══════════════════════════════════════════════════════════════

// Create a new parlay bet
export const createParlay = mutation({
  args: {
    guildId: v.string(),
    pointsWagered: v.number(),
    legs: v.array(
      v.object({
        wagerId: v.id("wagers"),
        prediction: v.union(v.literal("success"), v.literal("fail")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate leg count
    if (args.legs.length < 2) {
      throw new Error("Parlays must have at least 2 legs");
    }
    if (args.legs.length > 10) {
      throw new Error("Parlays can have at most 10 legs");
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

    // Get user's server stats
    const stats = await ctx.db
      .query("userServerStats")
      .withIndex("by_userId_guildId", (q) =>
        q.eq("userId", user._id).eq("guildId", args.guildId)
      )
      .unique();

    if (!stats) {
      throw new Error("No points balance in this server");
    }

    if (stats.points < args.pointsWagered) {
      throw new Error(`Insufficient points. You have ${stats.points} points.`);
    }

    // Validate all wagers exist and are active
    const wagerIds = new Set<string>();
    for (const leg of args.legs) {
      // Check for duplicate wagers
      if (wagerIds.has(leg.wagerId)) {
        throw new Error("Cannot add the same wager to a parlay twice");
      }
      wagerIds.add(leg.wagerId);

      const wager = await ctx.db.get(leg.wagerId);
      if (!wager) {
        throw new Error("Wager not found");
      }
      if (wager.status !== "active") {
        throw new Error("Can only bet on active wagers");
      }
      // Cannot bet on your own wagers
      if (wager.userId === user._id) {
        throw new Error("Cannot include your own wagers in a parlay");
      }
    }

    // Calculate potential payout (1.5x per leg)
    const multiplier = Math.pow(1.5, args.legs.length);
    const potentialPayout = Math.floor(args.pointsWagered * multiplier);

    // Deduct points
    await ctx.db.patch(stats._id, {
      points: stats.points - args.pointsWagered,
    });

    // Create the parlay
    const parlayId = await ctx.db.insert("parlayBets", {
      oddsmakerDiscordId: user.discordId,
      oddsmakerUsername: user.discordUsername,
      guildId: args.guildId,
      pointsWagered: args.pointsWagered,
      status: "pending",
      potentialPayout,
      settled: false,
      createdAt: Date.now(),
    });

    // Create the legs
    for (const leg of args.legs) {
      await ctx.db.insert("parlayLegs", {
        parlayId,
        wagerId: leg.wagerId,
        prediction: leg.prediction,
        status: "pending",
      });
    }

    return {
      parlayId,
      potentialPayout,
      remainingPoints: stats.points - args.pointsWagered,
      multiplier: multiplier.toFixed(2),
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

// Get user's parlays
export const getMyParlays = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) =>
        q.eq("betterAuthUserId", identity.subject)
      )
      .unique();

    if (!user) return [];

    const parlays = await ctx.db
      .query("parlayBets")
      .withIndex("by_oddsmaker", (q) => q.eq("oddsmakerDiscordId", user.discordId))
      .order("desc")
      .take(50);

    // Get legs and wager details for each parlay
    const parlaysWithDetails = await Promise.all(
      parlays.map(async (parlay) => {
        const legs = await ctx.db
          .query("parlayLegs")
          .withIndex("by_parlayId", (q) => q.eq("parlayId", parlay._id))
          .collect();

        const legsWithWagers = await Promise.all(
          legs.map(async (leg) => {
            const wager = await ctx.db.get(leg.wagerId);
            return {
              ...leg,
              wager: wager
                ? {
                    _id: wager._id,
                    task: wager.task,
                    status: wager.status,
                    deadline: wager.deadline,
                  }
                : null,
            };
          })
        );

        // Get server name
        const server = await ctx.db
          .query("discordServers")
          .withIndex("by_guildId", (q) => q.eq("guildId", parlay.guildId))
          .unique();

        return {
          ...parlay,
          legs: legsWithWagers,
          serverName: server?.guildName || "Unknown Server",
        };
      })
    );

    return parlaysWithDetails;
  },
});

// Get available wagers for parlay (active wagers user can bet on)
export const getAvailableWagersForParlay = query({
  args: {
    guildId: v.string(),
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

    // Get active wagers in this guild (excluding user's own)
    const wagers = await ctx.db
      .query("wagers")
      .withIndex("by_guildId", (q) => q.eq("guildId", args.guildId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.neq(q.field("userId"), user._id)
        )
      )
      .collect();

    // Get creator details for each wager
    const wagersWithCreators = await Promise.all(
      wagers.map(async (wager) => {
        const creator = await ctx.db.get(wager.userId);
        return {
          _id: wager._id,
          task: wager.task,
          deadline: wager.deadline,
          creatorUsername: creator?.discordUsername || "Unknown",
          creatorDisplayName: creator?.discordDisplayName || creator?.discordUsername || "Unknown",
        };
      })
    );

    return wagersWithCreators;
  },
});

// ═══════════════════════════════════════════════════════════════
// Internal Settlement
// ═══════════════════════════════════════════════════════════════

// Called when a wager settles - update all related parlay legs
export const settleParlayLegsForWager = internalMutation({
  args: {
    wagerId: v.id("wagers"),
    wagerPassed: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Find all legs referencing this wager
    const legs = await ctx.db
      .query("parlayLegs")
      .withIndex("by_wagerId", (q) => q.eq("wagerId", args.wagerId))
      .collect();

    for (const leg of legs) {
      // Determine if this leg is correct
      const predictionMatches =
        (leg.prediction === "success" && args.wagerPassed) ||
        (leg.prediction === "fail" && !args.wagerPassed);

      const newStatus = predictionMatches ? "correct" : "incorrect";

      await ctx.db.patch(leg._id, { status: newStatus });

      // Check if the parlay should be settled
      await checkAndSettleParlay(ctx, leg.parlayId);
    }
  },
});

// Check if a parlay should be settled and settle it if so
async function checkAndSettleParlay(ctx: MutationCtx, parlayId: Id<"parlayBets">) {
  const parlay = await ctx.db.get(parlayId);
  if (!parlay || parlay.settled) return;

  const legs = await ctx.db
    .query("parlayLegs")
    .withIndex("by_parlayId", (q) => q.eq("parlayId", parlayId))
    .collect();

  // Check if any leg is incorrect (parlay lost)
  const hasIncorrect = legs.some((l: { status: string }) => l.status === "incorrect");
  if (hasIncorrect) {
    // Parlay lost
    await ctx.db.patch(parlayId, {
      status: "lost",
      settled: true,
      actualPayout: 0,
    });
    return;
  }

  // Check if all legs are correct (parlay won)
  const allCorrect = legs.every((l: { status: string }) => l.status === "correct");
  if (allCorrect) {
    // Parlay won - pay out!
    const user = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", parlay.oddsmakerDiscordId))
      .unique();

    if (user) {
      const stats = await ctx.db
        .query("userServerStats")
        .withIndex("by_userId_guildId", (q) =>
          q.eq("userId", user._id).eq("guildId", parlay.guildId)
        )
        .unique();

      if (stats) {
        await ctx.db.patch(stats._id, {
          points: stats.points + parlay.potentialPayout,
          totalPointsWon: stats.totalPointsWon + parlay.potentialPayout,
        });
      }
    }

    await ctx.db.patch(parlayId, {
      status: "won",
      settled: true,
      actualPayout: parlay.potentialPayout,
    });
    return;
  }

  // Still pending (some legs not resolved yet)
}

// Cancel parlay legs when a wager is cancelled
export const cancelParlayLegsForWager = internalMutation({
  args: {
    wagerId: v.id("wagers"),
  },
  handler: async (ctx, args) => {
    const legs = await ctx.db
      .query("parlayLegs")
      .withIndex("by_wagerId", (q) => q.eq("wagerId", args.wagerId))
      .collect();

    for (const leg of legs) {
      await ctx.db.patch(leg._id, { status: "cancelled" });

      // Check parlay - if only one leg remains, void the parlay
      const parlay = await ctx.db.get(leg.parlayId);
      if (!parlay || parlay.settled) continue;

      const remainingLegs = await ctx.db
        .query("parlayLegs")
        .withIndex("by_parlayId", (q) => q.eq("parlayId", leg.parlayId))
        .filter((q) => q.neq(q.field("status"), "cancelled"))
        .collect();

      if (remainingLegs.length < 2) {
        // Void the parlay and refund
        const user = await ctx.db
          .query("users")
          .withIndex("by_discordId", (q) => q.eq("discordId", parlay.oddsmakerDiscordId))
          .unique();

        if (user) {
          const stats = await ctx.db
            .query("userServerStats")
            .withIndex("by_userId_guildId", (q) =>
              q.eq("userId", user._id).eq("guildId", parlay.guildId)
            )
            .unique();

          if (stats) {
            await ctx.db.patch(stats._id, {
              points: stats.points + parlay.pointsWagered,
            });
          }
        }

        await ctx.db.patch(leg.parlayId, {
          status: "void",
          settled: true,
          actualPayout: parlay.pointsWagered, // Refund
        });
      } else {
        // Recalculate payout with remaining legs
        const newMultiplier = Math.pow(1.5, remainingLegs.length);
        const newPotentialPayout = Math.floor(parlay.pointsWagered * newMultiplier);

        await ctx.db.patch(leg.parlayId, {
          potentialPayout: newPotentialPayout,
        });
      }
    }
  },
});
