"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { Trophy } from "lucide-react";

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string | null;
  completedWagers: number;
  totalWagers: number;
  failedWagers: number;
  successRate: number;
  rank: number;
}

interface RankingCardProps {
  user: LeaderboardUser;
  className?: string;
  showDetails?: boolean;
}

export function RankingCard({
  user,
  className,
  showDetails = false,
}: RankingCardProps) {
  const isTop3 = user.rank <= 3;

  return (
    <div
      className={cn(
        "group flex items-center gap-4 rounded-sm border border-border bg-card p-4 transition-all",
        "hover:border-primary",
        isTop3 && "border-primary bg-background-secondary",
        className
      )}
    >
      {/* Rank */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm font-bold border",
          user.rank === 1 && "bg-amber-100 text-amber-600 border-amber-300",
          user.rank === 2 && "bg-slate-100 text-slate-500 border-slate-300",
          user.rank === 3 && "bg-orange-100 text-orange-600 border-orange-300",
          user.rank > 3 && "bg-muted text-muted-foreground border-border"
        )}
      >
        {user.rank <= 3 ? (
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
        <p className="font-medium truncate">{user.name}</p>
        {showDetails ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Success Rate</span>
              <span className="font-medium text-success">{user.successRate}%</span>
            </div>
            <Progress value={user.successRate} className="h-1.5" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {user.completedWagers} completed · {user.successRate}% success
          </p>
        )}
      </div>

      {/* Stats */}
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
          <p className="text-lg font-bold">{user.totalWagers}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>
    </div>
  );
}
