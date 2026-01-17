"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "~/components/ui/arrow-right";
import { FlameIcon } from "~/components/ui/flame";
import { Trophy } from "lucide-react";

interface LeaderboardPreviewProps {
  className?: string;
}

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string | null;
  completedWagers: number;
  totalWagers: number;
  currentStreak: number;
  successRate: number;
  rank: number;
}

const rankConfig = [
  {
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-300",
  },
  {
    color: "text-slate-500",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
  },
  {
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300",
  },
];

export function LeaderboardPreview({ className }: LeaderboardPreviewProps) {
  const leaderboardData = useQuery(api.leaderboard.getGlobalLeaderboard);

  // Map Convex data to component's expected structure
  const users: LeaderboardUser[] = leaderboardData
    ? leaderboardData.slice(0, 5).map((user, index) => ({
        id: user.discordId,
        name: user.discordUsername,
        avatar: user.discordAvatarUrl ?? null,
        completedWagers: user.completedWagers,
        totalWagers: user.totalWagers,
        currentStreak: user.currentStreak,
        successRate: user.totalWagers > 0
          ? Math.round((user.completedWagers / user.totalWagers) * 100)
          : 0,
        rank: index + 1,
      }))
    : [];

  const isLoading = leaderboardData === undefined;
  const isEmpty = leaderboardData !== undefined && leaderboardData.length === 0;

  return (
    <section className={cn("py-20 sm:py-28 bg-background-secondary relative overflow-hidden", className)}>
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)`,
          backgroundSize: "4rem 4rem",
        }}
      />
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2
            className="text-3xl sm:text-4xl font-bold text-foreground mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Leaderboard
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Top performers this month. Complete wagers and climb the ranks.
          </p>
        </div>

        <Card className="bg-card border border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-primary" />
              <CardTitle
                className="text-foreground"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Top Performers
              </CardTitle>
            </div>
            <Link to="/leaderboard">
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                View All
                <ArrowRightIcon size={16} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <LeaderboardSkeleton />
            ) : isEmpty ? (
              <LeaderboardEmpty />
            ) : (
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <RankingRow key={user.id} user={user} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RankingRow({ user }: { user: LeaderboardUser }) {
  const isTop3 = user.rank <= 3;
  const config = isTop3 ? rankConfig[user.rank - 1] : null;

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 transition-colors",
        "hover:bg-background-secondary",
        isTop3 && "bg-background-secondary/50"
      )}
    >
      {/* Rank */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm font-bold border",
          isTop3 && config
            ? cn(config.bgColor, config.color, config.borderColor)
            : "bg-muted text-muted-foreground border-border"
        )}
      >
        {isTop3 ? (
          <Trophy className="size-5" />
        ) : (
          user.rank
        )}
      </div>

      {/* Avatar */}
      <Avatar>
        {user.avatar && <AvatarImage src={user.avatar} />}
        <AvatarFallback className="bg-background-secondary text-muted-foreground border border-border">
          {user.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{user.name}</p>
          {user.currentStreak >= 7 && (
            <Badge
              variant="outline"
              className="bg-orange-100 text-orange-600 border-orange-300"
            >
              <FlameIcon size={12} className="mr-1" />
              {user.currentStreak}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {user.completedWagers} completed · {user.successRate}% success
        </p>
      </div>

      {/* Stats - hidden on mobile */}
      <div className="hidden sm:flex items-center gap-6 text-center">
        <div>
          <p className="text-lg font-bold">{user.completedWagers}</p>
          <p className="text-xs text-muted-foreground">Won</p>
        </div>
        <div>
          <p className="text-lg font-bold text-success">{user.successRate}%</p>
          <p className="text-xs text-muted-foreground">Rate</p>
        </div>
        <div>
          <p className="text-lg font-bold text-orange-500">{user.currentStreak}</p>
          <p className="text-xs text-muted-foreground">Streak</p>
        </div>
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-sm" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="hidden sm:flex gap-6">
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-10 w-12" />
            <Skeleton className="h-10 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaderboardEmpty() {
  return <div className="py-16" />;
}
