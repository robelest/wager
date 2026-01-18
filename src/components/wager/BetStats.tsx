"use client";

import { cn } from "~/lib/utils";
import { TrendingUp, TrendingDown, Coins } from "lucide-react";

interface BetStatsProps {
  successCount: number;
  failCount: number;
  successPool: number;
  failPool: number;
  totalPool: number;
  successPercentage: number;
  className?: string;
}

export function BetStats({
  successCount,
  failCount,
  successPool,
  failPool,
  totalPool,
  successPercentage,
  className,
}: BetStatsProps) {
  const failPercentage = 100 - successPercentage;
  const totalBets = successCount + failCount;

  if (totalBets === 0) {
    return (
      <div className={cn("rounded-sm border border-border/50 bg-background/50 p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">No bets placed yet</p>
        <p className="text-xs text-muted-foreground mt-1">Be the first to predict the outcome!</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Pool totals */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-yellow-500" />
          <span className="text-muted-foreground">Total Pool</span>
        </div>
        <span className="font-bold">{totalPool} pts</span>
      </div>

      {/* Percentage bar */}
      <div className="h-3 rounded-sm overflow-hidden bg-muted flex">
        {successPercentage > 0 && (
          <div
            className="h-full bg-success transition-all duration-300"
            style={{ width: `${successPercentage}%` }}
          />
        )}
        {failPercentage > 0 && (
          <div
            className="h-full bg-destructive transition-all duration-300"
            style={{ width: `${failPercentage}%` }}
          />
        )}
      </div>

      {/* Stats breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Success pool */}
        <div className="rounded-sm border border-success/20 bg-success/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-success" />
            <span className="text-sm font-medium text-success">They'll succeed</span>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold">{successPool} pts</p>
            <p className="text-xs text-muted-foreground">
              {successCount} {successCount === 1 ? "bet" : "bets"} ({successPercentage}%)
            </p>
          </div>
        </div>

        {/* Fail pool */}
        <div className="rounded-sm border border-destructive/20 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="size-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">They'll fail</span>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold">{failPool} pts</p>
            <p className="text-xs text-muted-foreground">
              {failCount} {failCount === 1 ? "bet" : "bets"} ({failPercentage}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
