"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  Coins,
  Layers,
} from "lucide-react";
import type { Id } from "convex/_generated/dataModel";

interface ParlayLeg {
  _id: Id<"parlayLegs">;
  wagerId: Id<"wagers">;
  prediction: "success" | "fail";
  status: "pending" | "correct" | "incorrect" | "cancelled";
  wager: {
    _id: Id<"wagers">;
    task?: string;
    wagerTitle?: string;
    status: string;
    deadline?: number;
    finalDeadline?: number;
  } | null;
}

// Helper to get display task (handles multi-task wagers)
function getWagerTask(wager: { task?: string; wagerTitle?: string } | null): string {
  return wager?.task || wager?.wagerTitle || "Unknown task";
}

// Helper to get deadline (handles multi-task wagers)
function getWagerDeadline(wager: { deadline?: number; finalDeadline?: number } | null): number {
  return wager?.deadline || wager?.finalDeadline || Date.now();
}

interface Parlay {
  _id: Id<"parlayBets">;
  oddsmakerDiscordId: string;
  oddsmakerUsername: string;
  guildId: string;
  pointsWagered: number;
  status: "pending" | "won" | "lost" | "cancelled" | "void";
  potentialPayout: number;
  actualPayout?: number;
  settled: boolean;
  createdAt: number;
  legs: ParlayLeg[];
  serverName: string;
}

interface ParlayCardProps {
  parlay: Parlay;
}

export function ParlayCard({ parlay }: ParlayCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    pending: { label: "Active", color: "bg-primary/20 text-primary" },
    won: { label: "Won", color: "bg-success/20 text-success" },
    lost: { label: "Lost", color: "bg-destructive/20 text-destructive" },
    cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
    void: { label: "Voided", color: "bg-muted text-muted-foreground" },
  };

  const config = statusConfig[parlay.status];
  const multiplier = Math.pow(1.5, parlay.legs.length);

  // Count leg statuses
  const correctLegs = parlay.legs.filter((l) => l.status === "correct").length;
  const incorrectLegs = parlay.legs.filter((l) => l.status === "incorrect").length;
  const pendingLegs = parlay.legs.filter((l) => l.status === "pending").length;

  return (
    <Card className={cn("border-border/50", parlay.settled && "opacity-75")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span className="font-semibold">{parlay.legs.length}-Leg Parlay</span>
              <Badge variant="outline" className={cn("text-xs", config.color)}>
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{parlay.serverName}</p>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Coins className="size-4 text-yellow-500" />
              <span>{parlay.pointsWagered}</span>
              <span className="text-muted-foreground">
                {" → "}
                {parlay.status === "won" ? (
                  <span className="text-success">+{parlay.actualPayout}</span>
                ) : parlay.status === "lost" ? (
                  <span className="text-destructive">0</span>
                ) : (
                  <span className="text-primary">{parlay.potentialPayout}</span>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{multiplier.toFixed(2)}x multiplier</p>
          </div>
        </div>

        {/* Progress bar for pending parlays */}
        {parlay.status === "pending" && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>
                {correctLegs}/{parlay.legs.length} correct
              </span>
              <span>{pendingLegs} pending</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
              {correctLegs > 0 && (
                <div
                  className="bg-success"
                  style={{ width: `${(correctLegs / parlay.legs.length) * 100}%` }}
                />
              )}
              {incorrectLegs > 0 && (
                <div
                  className="bg-destructive"
                  style={{ width: `${(incorrectLegs / parlay.legs.length) * 100}%` }}
                />
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Expand/Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between text-muted-foreground hover:text-foreground"
        >
          <span>View {parlay.legs.length} legs</span>
          {isExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </Button>

        {/* Expanded Legs List */}
        {isExpanded && (
          <div className="mt-3 space-y-2">
            {parlay.legs.map((leg, index) => (
              <div
                key={leg._id}
                className={cn(
                  "flex items-start gap-3 p-2 rounded-sm border",
                  leg.status === "correct" && "border-success/30 bg-success/5",
                  leg.status === "incorrect" && "border-destructive/30 bg-destructive/5",
                  leg.status === "pending" && "border-border/50",
                  leg.status === "cancelled" && "border-muted bg-muted/30 opacity-60"
                )}
              >
                {/* Status Icon */}
                <div className="mt-0.5">
                  {leg.status === "correct" && (
                    <CheckCircle className="size-4 text-success" />
                  )}
                  {leg.status === "incorrect" && (
                    <XCircle className="size-4 text-destructive" />
                  )}
                  {leg.status === "pending" && (
                    <Clock className="size-4 text-muted-foreground" />
                  )}
                  {leg.status === "cancelled" && (
                    <XCircle className="size-4 text-muted-foreground" />
                  )}
                </div>

                {/* Leg Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {leg.wager ? getWagerTask(leg.wager) : "Wager not found"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        leg.prediction === "success"
                          ? "text-success border-success/30"
                          : "text-destructive border-destructive/30"
                      )}
                    >
                      {leg.prediction === "success" ? "Success" : "Fail"}
                    </Badge>
                    {leg.wager && leg.status === "pending" && (
                      <span className="text-[10px] text-muted-foreground">
                        Ends{" "}
                        {new Date(getWagerDeadline(leg.wager)).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Created timestamp */}
        <p className="mt-3 text-xs text-muted-foreground text-center">
          Created{" "}
          {new Date(parlay.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </CardContent>
    </Card>
  );
}
