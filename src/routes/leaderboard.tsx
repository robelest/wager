"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageWrapper } from "~/components/layout";
import { Podium, RankingCard } from "~/components/leaderboard";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import { Trophy, Target, Skull, Users } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const leaderboardData = useQuery(api.leaderboard.getFullLeaderboard);
  const isLoading = leaderboardData === undefined;

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  const categories = [
    {
      id: "reliable",
      label: "Most Reliable",
      icon: "trophy" as const,
      data: leaderboardData.mostReliable,
      description: "Highest success rate",
    },
    {
      id: "active",
      label: "Most Active",
      icon: "target" as const,
      data: leaderboardData.mostActive,
      description: "Total wagers made",
    },
    {
      id: "shame",
      label: "Hall of Shame",
      icon: "skull" as const,
      data: leaderboardData.hallOfShame,
      description: "Room for improvement",
    },
  ];

  const topThree = leaderboardData.mostReliable.slice(0, 3);

  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Leaderboard
          </h1>
          <p className="text-muted-foreground text-lg">
            The most accountable people in the community
          </p>
        </div>

        {/* Podium */}
        {topThree.length > 0 && (
          <Card className="border-border bg-card overflow-hidden">
            <CardContent className="pt-6">
              <div className="hidden md:block">
                <Podium users={topThree} />
              </div>
              {/* Mobile view for top 3 */}
              <div className="md:hidden space-y-3">
                {topThree.map((user) => (
                  <RankingCard key={user.id} user={user} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Players"
            value={leaderboardData.stats.totalUsers}
            icon="users"
          />
          <StatCard
            label="Total Wagers"
            value={leaderboardData.stats.totalWagers}
            icon="target"
          />
          <StatCard
            label="Avg Success Rate"
            value={`${leaderboardData.stats.avgSuccessRate}%`}
            icon="trophy"
          />
        </div>

        {/* Category Tabs */}
        <Tabs defaultValue="reliable" className="w-full">
          <TabsList className="w-full justify-start bg-background-secondary border border-border border-b-0 rounded-sm rounded-b-none h-auto gap-0 p-0">
            {categories.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="gap-2 px-4 py-3 rounded-none rounded-t-sm border-r border-border last:border-r-0 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:border-b-card data-[state=active]:relative data-[state=active]:z-10 data-[state=inactive]:text-muted-foreground"
              >
                <CategoryIcon icon={category.icon} className="size-4" />
                <span className="hidden sm:inline font-medium">{category.label}</span>
                <span className="sm:hidden font-medium">
                  {category.label.split(" ")[0]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-0">
              <Card className="border-border bg-card rounded-t-none border-t-0">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <CategoryIcon icon={category.icon} className="size-5 text-primary" />
                    <CardTitle>{category.label}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="divide-y divide-border">
                      {category.data.map((user) => (
                        <div key={user.id} className="p-4">
                          <RankingCard
                            user={user}
                            className="border-0 bg-transparent p-0 hover:bg-transparent"
                          />
                        </div>
                      ))}
                      {category.data.length === 0 && (
                        <EmptyState />
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PageWrapper>
  );
}

function EmptyState() {
  return <div className="py-16" />;
}

type CategoryIconType = "trophy" | "users" | "target" | "skull";

function CategoryIcon({ icon, className }: { icon: CategoryIconType; className?: string }) {
  switch (icon) {
    case "trophy":
      return <Trophy className={cn("size-5", className)} />;
    case "users":
      return <Users className={cn("size-5", className)} />;
    case "target":
      return <Target className={cn("size-5", className)} />;
    case "skull":
      return <Skull className={cn("size-5", className)} />;
    default:
      return null;
  }
}

function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon: CategoryIconType;
  trend?: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && (
                <span className="text-xs font-medium text-success">{trend}</span>
              )}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-background-secondary border border-border">
            <CategoryIcon icon={icon} className="size-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardSkeleton() {
  return (
    <PageWrapper maxWidth="xl">
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-5 w-96 mx-auto" />
        </div>
        <Skeleton className="h-80" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[400px]" />
      </div>
    </PageWrapper>
  );
}
