"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { TrendingUp, TrendingDown, Coins, AlertCircle } from "lucide-react";

interface BetFormProps {
  onSubmit: (prediction: "success" | "fail", points: number) => Promise<void>;
  isSubmitting?: boolean;
  userPoints: number;
  canBet: boolean;
  cantBetReason?: string;
  hasExistingBet?: boolean;
  isOwnWager?: boolean;
  successPool?: number;
  failPool?: number;
  className?: string;
}

export function BetForm({
  onSubmit,
  isSubmitting = false,
  userPoints,
  canBet,
  cantBetReason,
  hasExistingBet = false,
  isOwnWager = false,
  successPool = 0,
  failPool = 0,
  className,
}: BetFormProps) {
  const [prediction, setPrediction] = useState<"success" | "fail" | null>(null);
  const [points, setPoints] = useState(10);

  // Calculate potential payout
  const calculatePayout = (pred: "success" | "fail", betAmount: number) => {
    const totalPool = successPool + failPool + betAmount;
    const winningPool = pred === "success" ? successPool + betAmount : failPool + betAmount;
    if (winningPool === 0) return betAmount; // Edge case: first bet
    return Math.floor((betAmount / winningPool) * totalPool);
  };

  const potentialPayout = prediction ? calculatePayout(prediction, points) : null;

  const handleSubmit = async () => {
    if (!prediction || points < 10 || points > userPoints) return;
    await onSubmit(prediction, points);
  };

  // Show message if user can't bet
  if (isOwnWager) {
    return (
      <div className={cn("rounded-sm border border-border/50 bg-background/50 p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="size-4" />
          <span className="text-sm">You can't bet on your own wager</span>
        </div>
      </div>
    );
  }

  if (hasExistingBet) {
    return (
      <div className={cn("rounded-sm border border-success/20 bg-success/5 p-4", className)}>
        <div className="flex items-center gap-2 text-success">
          <TrendingUp className="size-4" />
          <span className="text-sm font-medium">You've already placed a bet on this wager</span>
        </div>
      </div>
    );
  }

  if (!canBet) {
    return (
      <div className={cn("rounded-sm border border-warning/20 bg-warning/5 p-4", className)}>
        <div className="flex items-center gap-2 text-warning">
          <AlertCircle className="size-4" />
          <span className="text-sm">{cantBetReason || "You need to create a wager this week to bet"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* User's points */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Your balance</span>
        <div className="flex items-center gap-1 font-medium">
          <Coins className="size-4 text-yellow-500" />
          <span>{userPoints} pts</span>
        </div>
      </div>

      {/* Prediction selection */}
      <div className="space-y-2">
        <Label>Your prediction</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPrediction("success")}
            disabled={isSubmitting}
            className={cn(
              "flex items-center justify-center gap-2 p-3 rounded-sm border transition-all text-sm font-medium",
              prediction === "success"
                ? "border-success bg-success/10 text-success ring-1 ring-success"
                : "border-border/50 hover:border-success/50 hover:bg-success/5"
            )}
          >
            <TrendingUp className="size-4" />
            They'll succeed
          </button>
          <button
            type="button"
            onClick={() => setPrediction("fail")}
            disabled={isSubmitting}
            className={cn(
              "flex items-center justify-center gap-2 p-3 rounded-sm border transition-all text-sm font-medium",
              prediction === "fail"
                ? "border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive"
                : "border-border/50 hover:border-destructive/50 hover:bg-destructive/5"
            )}
          >
            <TrendingDown className="size-4" />
            They'll fail
          </button>
        </div>
      </div>

      {/* Points input */}
      <div className="space-y-2">
        <Label htmlFor="points">Points to wager</Label>
        <div className="flex items-center gap-2">
          <Input
            id="points"
            type="number"
            min={10}
            max={userPoints}
            value={points}
            onChange={(e) => setPoints(Math.max(10, Math.min(userPoints, parseInt(e.target.value) || 10)))}
            disabled={isSubmitting}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">min 10</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPoints(userPoints)}
            disabled={isSubmitting}
          >
            All in
          </Button>
        </div>
      </div>

      {/* Potential payout */}
      {prediction && potentialPayout !== null && (
        <div className={cn(
          "rounded-sm border p-3 text-sm",
          prediction === "success"
            ? "border-success/20 bg-success/5"
            : "border-destructive/20 bg-destructive/5"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Potential payout</span>
            <span className={cn(
              "font-bold",
              prediction === "success" ? "text-success" : "text-destructive"
            )}>
              ~{potentialPayout} pts
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {potentialPayout > points
              ? `+${potentialPayout - points} profit if you win`
              : "Returns your bet if you win"}
          </p>
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || !prediction || points < 10 || points > userPoints}
        className={cn(
          "w-full gap-2",
          prediction === "success" && "glow-success bg-success hover:bg-success/80",
          prediction === "fail" && "glow-destructive bg-destructive hover:bg-destructive/80"
        )}
      >
        {isSubmitting ? (
          "Placing bet..."
        ) : (
          <>
            <Coins className="size-4" />
            Place Bet ({points} pts)
          </>
        )}
      </Button>
    </div>
  );
}
