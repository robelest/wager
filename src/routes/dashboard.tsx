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
} from "~/components/wager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { data: session, isPending: sessionPending } = useSession();

  // Fetch user profile and wagers from Convex
  const profile = useQuery(api.wagers.getMyProfile);
  const wagers = useQuery(api.wagers.getMyWagers, {});

  const isLoading = sessionPending || profile === undefined || wagers === undefined;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!session?.user) {
    return null;
  }

  // Filter wagers by status
  const activeWagers = wagers?.filter((w) => w.status === "active") ?? [];
  const completedWagers = wagers?.filter((w) => w.status === "completed") ?? [];
  const failedWagers = wagers?.filter((w) => w.status === "failed") ?? [];

  // Build stats from profile
  const stats = profile
    ? {
        totalWagers: profile.totalWagers,
        completedWagers: profile.completedWagers,
        failedWagers: profile.failedWagers,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
      }
    : {
        totalWagers: 0,
        completedWagers: 0,
        failedWagers: 0,
        currentStreak: 0,
        longestStreak: 0,
      };

  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-8">
        {/* Dashboard Header */}
        <DashboardHeader user={session.user} stats={stats} />

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Wagers Section */}
          <div className="space-y-6">
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="justify-start">
                <TabsTrigger value="active">
                  Active {activeWagers.length > 0 && `(${activeWagers.length})`}
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed {completedWagers.length > 0 && `(${completedWagers.length})`}
                </TabsTrigger>
                <TabsTrigger value="failed">
                  Failed {failedWagers.length > 0 && `(${failedWagers.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-6">
                {activeWagers.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeWagers.map((wager) => (
                      <WagerCard key={wager._id} wager={wager} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="completed" className="mt-6">
                {completedWagers.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {completedWagers.map((wager) => (
                      <WagerCard key={wager._id} wager={wager} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="failed" className="mt-6">
                {failedWagers.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {failedWagers.map((wager) => (
                      <WagerCard key={wager._id} wager={wager} />
                    ))}
                  </div>
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
    </PageWrapper>
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
