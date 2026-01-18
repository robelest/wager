"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  X,
  Plus,
  Coins,
  CheckCircle,
  XCircle,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Id } from "convex/_generated/dataModel";

export interface ParlayLeg {
  wagerId: Id<"wagers">;
  task: string;
  creatorUsername: string;
  deadline: number;
  prediction: "success" | "fail";
}

interface ParlayBuilderProps {
  legs: ParlayLeg[];
  onRemoveLeg: (wagerId: Id<"wagers">) => void;
  onTogglePrediction: (wagerId: Id<"wagers">) => void;
  onClear: () => void;
  onSubmit: (pointsWagered: number) => Promise<void>;
  isSubmitting?: boolean;
  userPoints: number;
  minBet?: number;
}

export function ParlayBuilder({
  legs,
  onRemoveLeg,
  onTogglePrediction,
  onClear,
  onSubmit,
  isSubmitting = false,
  userPoints,
  minBet = 5,
}: ParlayBuilderProps) {
  const [pointsWagered, setPointsWagered] = useState(minBet);
  const [isExpanded, setIsExpanded] = useState(true);

  if (legs.length === 0) {
    return null;
  }

  const multiplier = Math.pow(1.5, legs.length);
  const potentialPayout = Math.floor(pointsWagered * multiplier);
  const canSubmit =
    legs.length >= 2 &&
    pointsWagered >= minBet &&
    pointsWagered <= userPoints &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (canSubmit) {
      await onSubmit(pointsWagered);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg">
      <div className="max-w-screen-xl mx-auto">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-5 text-primary" />
                <CardTitle className="text-base">
                  Building Parlay ({legs.length} leg{legs.length !== 1 ? "s" : ""})
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-8 w-8 p-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronUp className="size-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Clear All
                </Button>
              </div>
            </div>
          </CardHeader>

          {isExpanded && (
            <CardContent className="space-y-4">
              {/* Legs List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {legs.map((leg) => (
                  <div
                    key={leg.wagerId}
                    className="flex items-center gap-2 p-2 rounded-sm border border-border/50 bg-background/50"
                  >
                    {/* Prediction Toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTogglePrediction(leg.wagerId)}
                      className={cn(
                        "h-7 px-2 shrink-0",
                        leg.prediction === "success"
                          ? "text-success hover:text-success"
                          : "text-destructive hover:text-destructive"
                      )}
                    >
                      {leg.prediction === "success" ? (
                        <CheckCircle className="size-4 mr-1" />
                      ) : (
                        <XCircle className="size-4 mr-1" />
                      )}
                      {leg.prediction === "success" ? "Win" : "Fail"}
                    </Button>

                    {/* Leg Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{leg.task}</p>
                      <p className="text-xs text-muted-foreground">
                        by {leg.creatorUsername}
                      </p>
                    </div>

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveLeg(leg.wagerId)}
                      className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Stake & Payout */}
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="stake" className="text-sm">
                    Stake
                  </Label>
                  <div className="flex items-center gap-2">
                    <Coins className="size-4 text-yellow-500" />
                    <Input
                      id="stake"
                      type="number"
                      min={minBet}
                      max={userPoints}
                      value={pointsWagered}
                      onChange={(e) =>
                        setPointsWagered(Math.max(minBet, parseInt(e.target.value) || minBet))
                      }
                      className="w-24 h-9"
                    />
                    <span className="text-xs text-muted-foreground">
                      / {userPoints} pts
                    </span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {multiplier.toFixed(2)}x multiplier
                  </p>
                  <p className="text-lg font-bold text-primary">
                    Win {potentialPayout} pts
                  </p>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    "Placing..."
                  ) : legs.length < 2 ? (
                    "Add 1 more"
                  ) : (
                    <>
                      <Layers className="size-4" />
                      Place Parlay
                    </>
                  )}
                </Button>
              </div>

              {/* Warnings */}
              {pointsWagered > userPoints && (
                <p className="text-xs text-destructive">
                  Insufficient points. You have {userPoints} pts.
                </p>
              )}
              {legs.length < 2 && (
                <p className="text-xs text-muted-foreground">
                  Add at least 2 wagers to create a parlay.
                </p>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

// Hook for managing parlay state
export function useParlayBuilder() {
  const [legs, setLegs] = useState<ParlayLeg[]>([]);

  const addLeg = (wager: {
    _id: Id<"wagers">;
    task: string;
    creatorUsername: string;
    deadline: number;
  }) => {
    // Check if already added
    if (legs.some((l) => l.wagerId === wager._id)) {
      return false;
    }

    // Max 10 legs
    if (legs.length >= 10) {
      return false;
    }

    setLegs([
      ...legs,
      {
        wagerId: wager._id,
        task: wager.task,
        creatorUsername: wager.creatorUsername,
        deadline: wager.deadline,
        prediction: "success", // Default to success
      },
    ]);
    return true;
  };

  const removeLeg = (wagerId: Id<"wagers">) => {
    setLegs(legs.filter((l) => l.wagerId !== wagerId));
  };

  const togglePrediction = (wagerId: Id<"wagers">) => {
    setLegs(
      legs.map((l) =>
        l.wagerId === wagerId
          ? { ...l, prediction: l.prediction === "success" ? "fail" : "success" }
          : l
      )
    );
  };

  const clear = () => {
    setLegs([]);
  };

  const isInParlay = (wagerId: Id<"wagers">) => {
    return legs.some((l) => l.wagerId === wagerId);
  };

  return {
    legs,
    addLeg,
    removeLeg,
    togglePrediction,
    clear,
    isInParlay,
  };
}
