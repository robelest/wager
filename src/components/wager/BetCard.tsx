"use client";

import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { TrendingUp, TrendingDown, Coins, Clock, CheckCircle2, XCircle } from "lucide-react";

interface BetCardProps {
  bet: {
    _id: string;
    prediction: "success" | "fail";
    pointsWagered: number;
    settled: boolean;
    payout?: number;
    profit: number | null;
    createdAt: number;
    wager: {
      _id: string;
      task?: string;
      wagerTitle?: string;
      consequence: string;
      status: string;
      deadline?: number;
      finalDeadline?: number;
      user: {
        name: string | null;
        avatar?: string;
      } | null;
      server: {
        guildId: string;
        guildName: string;
      } | null;
    };
  };
  className?: string;
}

// Helper to get display task (handles multi-task wagers)
function getWagerTask(wager: { task?: string; wagerTitle?: string }): string {
  return wager.task || wager.wagerTitle || "Unknown task";
}

// Helper to get deadline (handles multi-task wagers)
function getWagerDeadline(wager: { deadline?: number; finalDeadline?: number }): number {
  return wager.deadline || wager.finalDeadline || Date.now();
}

export function BetCard({ bet, className }: BetCardProps) {
  const isWin = bet.settled && bet.profit !== null && bet.profit > 0;
  const isLoss = bet.settled && bet.profit !== null && bet.profit < 0;
  const isPending = !bet.settled;

  return (
    <Link to="/wager/$wagerId" params={{ wagerId: bet.wager._id }}>
      <Card
        className={cn(
          "border-border/50 bg-card/50 backdrop-blur-sm hover:border-border transition-all cursor-pointer",
          isPending && "border-l-4 border-l-yellow-500/50",
          isWin && "border-l-4 border-l-success/50",
          isLoss && "border-l-4 border-l-destructive/50",
          className
        )}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header: User & Server */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bet.wager.user?.avatar ? (
                <img
                  src={bet.wager.user.avatar}
                  alt=""
                  className="size-6 rounded-full"
                />
              ) : (
                <div className="size-6 rounded-full bg-muted" />
              )}
              <span className="text-sm font-medium truncate">
                {bet.wager.user?.name || "Unknown"}
              </span>
            </div>
            {bet.wager.server && (
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                {bet.wager.server.guildName}
              </span>
            )}
          </div>

          {/* Task */}
          <p className="text-sm line-clamp-2">{getWagerTask(bet.wager)}</p>

          {/* Your Prediction */}
          <div className="flex items-center justify-between">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium",
                bet.prediction === "success"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {bet.prediction === "success" ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              <span>
                You bet {bet.prediction === "success" ? "succeed" : "fail"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium">
              <Coins className="size-3.5 text-yellow-500" />
              <span>{bet.pointsWagered} pts</span>
            </div>
          </div>

          {/* Status / Result */}
          <div
            className={cn(
              "flex items-center justify-between p-2 rounded-sm text-sm",
              isPending && "bg-yellow-500/5 border border-yellow-500/20",
              isWin && "bg-success/5 border border-success/20",
              isLoss && "bg-destructive/5 border border-destructive/20"
            )}
          >
            <div className="flex items-center gap-1.5">
              {isPending && (
                <>
                  <Clock className="size-3.5 text-yellow-500" />
                  <span className="text-yellow-500">Pending</span>
                </>
              )}
              {isWin && (
                <>
                  <CheckCircle2 className="size-3.5 text-success" />
                  <span className="text-success">Won</span>
                </>
              )}
              {isLoss && (
                <>
                  <XCircle className="size-3.5 text-destructive" />
                  <span className="text-destructive">Lost</span>
                </>
              )}
            </div>
            {bet.settled && bet.profit !== null && (
              <span
                className={cn(
                  "font-bold",
                  isWin && "text-success",
                  isLoss && "text-destructive"
                )}
              >
                {isWin ? "+" : ""}
                {bet.profit} pts
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
