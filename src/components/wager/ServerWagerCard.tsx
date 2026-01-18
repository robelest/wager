"use client";

import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { TrendingUp, TrendingDown, Clock, Users, Layers, Check } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";

interface ServerWagerCardProps {
  wager: {
    _id: string;
    task?: string;
    wagerTitle?: string;
    consequence: string;
    deadline?: number;
    finalDeadline?: number;
    status: string;
    user: {
      name: string | null;
      avatar?: string;
    } | null;
    server: {
      guildId: string;
      guildName: string;
    } | null;
    betStats: {
      total: number;
      successCount: number;
      failCount: number;
      successPool: number;
      failPool: number;
    };
  };
  className?: string;
  onAddToParlay?: (wager: {
    _id: Id<"wagers">;
    task: string;
    creatorUsername: string;
    deadline: number;
  }) => void;
  isInParlay?: boolean;
}

// Helper to get display task (handles multi-task wagers)
function getWagerTask(wager: { task?: string; wagerTitle?: string }): string {
  return wager.task || wager.wagerTitle || "Unknown task";
}

// Helper to get deadline (handles multi-task wagers)
function getWagerDeadline(wager: { deadline?: number; finalDeadline?: number }): number {
  return wager.deadline || wager.finalDeadline || Date.now();
}

function formatTimeLeft(deadline: number): string {
  const diff = Math.max(0, deadline - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function ServerWagerCard({
  wager,
  className,
  onAddToParlay,
  isInParlay = false,
}: ServerWagerCardProps) {
  const totalPool = wager.betStats.successPool + wager.betStats.failPool;

  const handleAddToParlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToParlay) {
      onAddToParlay({
        _id: wager._id as Id<"wagers">,
        task: getWagerTask(wager),
        creatorUsername: wager.user?.name || "Unknown",
        deadline: getWagerDeadline(wager),
      });
    }
  };

  return (
    <Link to="/wager/$wagerId" params={{ wagerId: wager._id }}>
      <Card
        className={cn(
          "border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all cursor-pointer",
          isInParlay && "ring-1 ring-primary border-primary/50",
          className
        )}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header: User & Server */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {wager.user?.avatar ? (
                <img
                  src={wager.user.avatar}
                  alt=""
                  className="size-8 rounded-full"
                />
              ) : (
                <div className="size-8 rounded-full bg-muted" />
              )}
              <div>
                <span className="text-sm font-medium block">
                  {wager.user?.name || "Unknown"}
                </span>
                {wager.server && (
                  <span className="text-xs text-muted-foreground">
                    {wager.server.guildName}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>{formatTimeLeft(getWagerDeadline(wager))}</span>
            </div>
          </div>

          {/* Task */}
          <p className="text-sm font-medium line-clamp-2">{getWagerTask(wager)}</p>

          {/* Consequence */}
          <p className="text-xs text-muted-foreground line-clamp-1">
            Or: {wager.consequence}
          </p>

          {/* Bet Stats & Parlay Button */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="size-3 text-success" />
                <span className="text-success">{wager.betStats.successCount}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <TrendingDown className="size-3 text-destructive" />
                <span className="text-destructive">{wager.betStats.failCount}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3" />
                <span>{wager.betStats.total} bets</span>
                {totalPool > 0 && (
                  <span className="text-yellow-500 font-medium">
                    ({totalPool} pts)
                  </span>
                )}
              </div>
              {onAddToParlay && (
                <Button
                  variant={isInParlay ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs gap-1",
                    isInParlay && "bg-primary"
                  )}
                  onClick={handleAddToParlay}
                >
                  {isInParlay ? (
                    <>
                      <Check className="size-3" />
                      In Parlay
                    </>
                  ) : (
                    <>
                      <Layers className="size-3" />
                      Add
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
