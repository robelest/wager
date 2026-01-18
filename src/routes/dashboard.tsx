"use client";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession } from "~/lib/auth-client";
import { PageWrapper } from "~/components/layout";
import {
  WagerCard,
  DashboardHeader,
  StatsPanel,
  EmptyState,
  BetCard,
  ServerWagerCard,
  StatusFilter,
  ParlayBuilder,
  ParlayCard,
  useParlayBuilder,
  type WagerFilter,
  type BetFilter,
} from "~/components/wager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import { Target, Users, TrendingUp, Layers } from "lucide-react";
import { useState, useMemo } from "react";
import { useMutation, useQuery as useConvexQuery } from "convex/react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: DashboardPage,
});

// Threshold for "ending soon" items (24 hours in ms)
const ENDING_SOON_THRESHOLD = 24 * 60 * 60 * 1000;

// Sort wagers with "ending soon" active items first, then by status priority
function sortWagers<T extends { status: string; deadline?: number; createdAt: number }>(
  wagers: T[],
  filter: WagerFilter
): T[] {
  const now = Date.now();

  // If filtered, just show that status sorted by deadline
  if (filter !== "all") {
    return wagers
      .filter((w) => w.status === filter)
      .sort((a, b) => {
        // Active: soonest deadline first
        if (filter === "active" && a.deadline && b.deadline) {
          return a.deadline - b.deadline;
        }
        // Completed/Failed: most recent first
        return b.createdAt - a.createdAt;
      });
  }

  // Default view: smart sorting
  return [...wagers].sort((a, b) => {
    const aEndingSoon = a.status === "active" && a.deadline !== undefined && (a.deadline - now) < ENDING_SOON_THRESHOLD;
    const bEndingSoon = b.status === "active" && b.deadline !== undefined && (b.deadline - now) < ENDING_SOON_THRESHOLD;

    // Priority: ending soon active > other active > completed > failed
    const getPriority = (w: typeof a, endingSoon: boolean) => {
      if (w.status === "active" && endingSoon) return 0;
      if (w.status === "active") return 1;
      if (w.status === "completed") return 2;
      if (w.status === "failed") return 3;
      return 4;
    };

    const aPriority = getPriority(a, aEndingSoon);
    const bPriority = getPriority(b, bEndingSoon);

    if (aPriority !== bPriority) return aPriority - bPriority;

    // Within same priority: sort by deadline (ascending for active, descending for others)
    if (a.status === "active" && a.deadline && b.deadline) {
      return a.deadline - b.deadline;
    }
    return b.createdAt - a.createdAt;
  });
}

// Helper to get wager deadline (handles optional fields)
function getDeadline(wager: { deadline?: number; finalDeadline?: number }): number {
  return wager.deadline || wager.finalDeadline || Date.now();
}

// Sort bets with pending first, then by wager deadline
function sortBets<T extends { settled: boolean; wager: { deadline?: number; finalDeadline?: number }; createdAt: number }>(
  bets: T[],
  filter: BetFilter
): T[] {
  if (filter === "pending") {
    return bets
      .filter((b) => !b.settled)
      .sort((a, b) => getDeadline(a.wager) - getDeadline(b.wager));
  }

  if (filter === "settled") {
    return bets
      .filter((b) => b.settled)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Default "all": pending first (sorted by deadline), then settled
  const pending = bets.filter((b) => !b.settled).sort((a, b) => getDeadline(a.wager) - getDeadline(b.wager));
  const settled = bets.filter((b) => b.settled).sort((a, b) => b.createdAt - a.createdAt);

  return [...pending, ...settled];
}

function DashboardPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const [activeTab, setActiveTab] = useState<"my-wagers" | "server-feed" | "my-bets">("my-wagers");
  const [wagerFilter, setWagerFilter] = useState<WagerFilter>("all");
  const [betFilter, setBetFilter] = useState<BetFilter>("all");

  // Parlay builder state
  const parlayBuilder = useParlayBuilder();
  const createParlay = useMutation(api.parlays.createParlay);

  // Fetch user profile, stats, and wagers from Convex
  const profile = useQuery(api.wagers.getMyProfile);
  const myStats = useQuery(api.wagers.getMyStats);
  const wagers = useQuery(api.wagers.getMyWagers, {});
  const serverWagers = useQuery(api.wagers.getServerWagers, { status: "active" });
  const myBets = useQuery(api.bets.getMyBets);
  const myParlays = useQuery(api.parlays.getMyParlays);
  const totalPoints = useQuery(api.bets.getMyTotalPoints);

  const isLoading = sessionPending || profile === undefined || myStats === undefined || wagers === undefined;

  // Sort and filter wagers
  const sortedWagers = useMemo(() => {
    if (!wagers) return [];
    return sortWagers(wagers, wagerFilter);
  }, [wagers, wagerFilter]);

  // Sort server wagers by deadline (always active, sorted by soonest)
  const sortedServerWagers = useMemo(() => {
    if (!serverWagers) return [];
    return [...serverWagers].sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
  }, [serverWagers]);

  // Sort and filter bets
  const sortedBets = useMemo(() => {
    if (!myBets) return [];
    return sortBets(myBets, betFilter);
  }, [myBets, betFilter]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!session?.user) {
    return null;
  }

  // Build stats from getMyStats query
  const stats = myStats
    ? {
        totalWagers: myStats.totalWagers,
        completedWagers: myStats.completedWagers,
        failedWagers: myStats.failedWagers,
        activeWagers: myStats.activeWagers,
      }
    : {
        totalWagers: 0,
        completedWagers: 0,
        failedWagers: 0,
        activeWagers: 0,
      };

  // Get current filter and setter based on active tab
  const currentFilter = activeTab === "my-bets" ? betFilter : wagerFilter;
  const setCurrentFilter = activeTab === "my-bets"
    ? (v: WagerFilter | BetFilter) => setBetFilter(v as BetFilter)
    : (v: WagerFilter | BetFilter) => setWagerFilter(v as WagerFilter);

  // Get user's points for the first server (simple case)
  const userPoints = totalPoints?.total || 0;

  // Handle parlay submission
  const handleParlaySubmit = async (pointsWagered: number) => {
    if (parlayBuilder.legs.length < 2) {
      toast.error("Add at least 2 wagers to create a parlay");
      return;
    }

    // Get guildId from first leg's wager
    const firstLegWagerId = parlayBuilder.legs[0].wagerId;
    const firstWager = serverWagers?.find((w) => w._id === firstLegWagerId);
    if (!firstWager?.server?.guildId) {
      toast.error("Could not determine server for parlay");
      return;
    }

    try {
      const result = await createParlay({
        guildId: firstWager.server.guildId,
        pointsWagered,
        legs: parlayBuilder.legs.map((leg) => ({
          wagerId: leg.wagerId,
          prediction: leg.prediction,
        })),
      });

      toast.success("Parlay placed!", {
        description: `${parlayBuilder.legs.length}-leg parlay for ${result.multiplier}x. Good luck!`,
      });

      parlayBuilder.clear();
      setActiveTab("my-parlays");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to place parlay";
      toast.error(errorMessage);
    }
  };

  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-8">
        {/* Dashboard Header */}
        <DashboardHeader user={session.user} stats={stats} />

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main Tabs Section */}
          <div className="space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              className="w-full"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <TabsList className="justify-start">
                  <TabsTrigger value="my-wagers" className="gap-2">
                    <Target className="size-4" />
                    <span className="hidden sm:inline">My Wagers</span>
                    <span className="sm:hidden">Wagers</span>
                    {wagers && wagers.length > 0 && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm">
                        {wagers.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="server-feed" className="gap-2">
                    <Users className="size-4" />
                    <span className="hidden sm:inline">Server Feed</span>
                    <span className="sm:hidden">Feed</span>
                    {serverWagers && serverWagers.length > 0 && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm">
                        {serverWagers.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="my-bets" className="gap-2">
                    <TrendingUp className="size-4" />
                    <span className="hidden sm:inline">My Bets</span>
                    <span className="sm:hidden">Bets</span>
                    {((myBets?.length ?? 0) + (myParlays?.length ?? 0)) > 0 && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm">
                        {(myBets?.length ?? 0) + (myParlays?.length ?? 0)}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Filter dropdown - hide for Server Feed */}
                {activeTab !== "server-feed" && (
                  <StatusFilter
                    value={currentFilter}
                    onChange={setCurrentFilter}
                    type={activeTab === "my-bets" ? "bet" : "wager"}
                  />
                )}
              </div>

              {/* My Wagers Tab */}
              <TabsContent value="my-wagers" className="mt-6">
                {sortedWagers.length === 0 ? (
                  wagerFilter === "all" ? (
                    <EmptyState />
                  ) : (
                    <FilteredEmptyState
                      filter={wagerFilter}
                      type="wager"
                      onClear={() => setWagerFilter("all")}
                    />
                  )
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {sortedWagers.map((wager) => (
                      <WagerCard key={wager._id} wager={wager} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Server Feed Tab */}
              <TabsContent value="server-feed" className="mt-6">
                {serverWagers === undefined ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                  </div>
                ) : sortedServerWagers.length === 0 ? (
                  <EmptyStateMessage message="No active wagers from your servers to bet on. Check back later!" />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {sortedServerWagers.map((wager) => (
                      <ServerWagerCard
                        key={wager._id}
                        wager={wager}
                        onAddToParlay={(w) => {
                          if (parlayBuilder.isInParlay(w._id)) {
                            parlayBuilder.removeLeg(w._id);
                          } else {
                            parlayBuilder.addLeg(w);
                          }
                        }}
                        isInParlay={parlayBuilder.isInParlay(wager._id as any)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* My Bets Tab - includes both individual bets and parlays */}
              <TabsContent value="my-bets" className="mt-6 space-y-6">
                {myBets === undefined || myParlays === undefined ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                  </div>
                ) : sortedBets.length === 0 && myParlays.length === 0 ? (
                  betFilter === "all" ? (
                    <EmptyStateMessage message="You haven't placed any bets yet. Check the Server Feed to bet on others' wagers!" />
                  ) : (
                    <FilteredEmptyState
                      filter={betFilter}
                      type="bet"
                      onClear={() => setBetFilter("all")}
                    />
                  )
                ) : (
                  <>
                    {/* Parlays Section */}
                    {myParlays.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Layers className="size-4" />
                          <span>Parlays ({myParlays.length})</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {myParlays.map((parlay) => (
                            <ParlayCard key={parlay._id} parlay={parlay} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Individual Bets Section */}
                    {sortedBets.length > 0 && (
                      <div className="space-y-3">
                        {myParlays.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="size-4" />
                            <span>Single Bets ({sortedBets.length})</span>
                          </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          {sortedBets.map((bet) => (
                            <BetCard key={bet._id} bet={bet} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Stats Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <StatsPanel stats={stats} />
            </div>
          </aside>
        </div>
      </div>

      {/* Parlay Builder (sticky bottom) */}
      <ParlayBuilder
        legs={parlayBuilder.legs}
        onRemoveLeg={parlayBuilder.removeLeg}
        onTogglePrediction={parlayBuilder.togglePrediction}
        onClear={parlayBuilder.clear}
        onSubmit={handleParlaySubmit}
        userPoints={userPoints}
      />
    </PageWrapper>
  );
}

function FilteredEmptyState({
  filter,
  type,
  onClear,
}: {
  filter: string;
  type: "wager" | "bet";
  onClear: () => void;
}) {
  const messages: Record<string, string> = {
    active: "No active wagers",
    completed: "No completed wagers yet",
    failed: "No failed wagers - keep it up!",
    pending: "No pending bets",
    settled: "No settled bets yet",
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
      <p className="text-muted-foreground text-sm">{messages[filter] || "No items found"}</p>
      <button
        onClick={onClear}
        className="text-sm text-primary hover:underline"
      >
        View all {type === "wager" ? "wagers" : "bets"}
      </button>
    </div>
  );
}

function EmptyStateMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          </div>
          <Skeleton className="hidden lg:block h-96" />
        </div>
      </div>
    </PageWrapper>
  );
}
