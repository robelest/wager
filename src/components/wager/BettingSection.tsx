"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BetStats } from "./BetStats";
import { BetForm } from "./BetForm";
import { cn } from "~/lib/utils";
import { Coins, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

interface BettingSectionProps {
  wagerId: Id<"wagers">;
  guildId: string;
  isOwner: boolean;
  wagerStatus: string;
  className?: string;
}

export function BettingSection({
  wagerId,
  guildId,
  isOwner,
  wagerStatus,
  className,
}: BettingSectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBets, setShowBets] = useState(false);
  const [discordInfo, setDiscordInfo] = useState<{
    discordId: string | null;
    username: string | null;
  }>({ discordId: null, username: null });

  // Get Discord account info
  const getDiscordAccountInfo = useAction(api.auth.getDiscordAccountInfo);

  // Fetch Discord info on mount
  useEffect(() => {
    async function fetchDiscordInfo() {
      const info = await getDiscordAccountInfo();
      setDiscordInfo(info);
    }
    fetchDiscordInfo();
  }, [getDiscordAccountInfo]);

  // Queries
  const betStats = useQuery(api.bets.getBetStats, { wagerId });
  const bets = useQuery(api.bets.getBetsForWager, { wagerId });
  const canBetResult = useQuery(
    api.bets.canUserBet,
    discordInfo.discordId ? { discordId: discordInfo.discordId, guildId } : "skip"
  );
  const userPoints = useQuery(
    api.bets.getUserServerPoints,
    discordInfo.discordId ? { discordId: discordInfo.discordId, guildId } : "skip"
  );

  // Mutation
  const placeBet = useMutation(api.bets.placeBet);

  // Check if user has already bet
  const hasExistingBet = bets?.some(
    (bet) => bet.oddsmakerDiscordId === discordInfo.discordId
  );

  const handlePlaceBet = async (prediction: "success" | "fail", points: number) => {
    if (!discordInfo.discordId || !discordInfo.username) {
      toast.error("Not authenticated", {
        description: "Please sign in with Discord to place bets.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await placeBet({
        wagerId: wagerId as string,
        oddsmakerDiscordId: discordInfo.discordId,
        oddsmakerUsername: discordInfo.username,
        prediction,
        pointsWagered: points,
      });

      const predictionText = prediction === "success" ? "succeed" : "fail";
      toast.success("Bet placed!", {
        description: `You bet ${points} pts that they'll ${predictionText}. ${result.remainingPoints} pts remaining.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      toast.error("Failed to place bet", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't show betting for completed/failed wagers or if no Discord info yet
  if (wagerStatus !== "active") {
    return null;
  }

  const isLoading = betStats === undefined || !discordInfo.discordId;

  return (
    <Card className={cn("border-border/50 bg-card/50 backdrop-blur-sm", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="size-5 text-yellow-500" />
          Place Your Bet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Bet Stats */}
            <BetStats
              successCount={betStats?.successCount || 0}
              failCount={betStats?.failCount || 0}
              successPool={betStats?.successPool || 0}
              failPool={betStats?.failPool || 0}
              totalPool={betStats?.totalPool || 0}
              successPercentage={betStats?.successPercentage || 0}
            />

            {/* Bet Form */}
            <BetForm
              onSubmit={handlePlaceBet}
              isSubmitting={isSubmitting}
              userPoints={userPoints?.points || 100}
              canBet={canBetResult?.canBet || false}
              cantBetReason={canBetResult?.reason}
              hasExistingBet={hasExistingBet}
              isOwnWager={isOwner}
              successPool={betStats?.successPool || 0}
              failPool={betStats?.failPool || 0}
            />

            {/* Show bets list */}
            {bets && bets.length > 0 && (
              <div className="border-t border-border/50 pt-4">
                <button
                  onClick={() => setShowBets(!showBets)}
                  className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>View all bets ({bets.length})</span>
                  {showBets ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>

                {showBets && (
                  <div className="mt-3 space-y-2">
                    {bets.map((bet) => (
                      <div
                        key={bet._id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-sm text-sm",
                          bet.prediction === "success"
                            ? "bg-success/5 border border-success/20"
                            : "bg-destructive/5 border border-destructive/20"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{bet.oddsmakerUsername}</span>
                          <span className={cn(
                            "text-xs",
                            bet.prediction === "success" ? "text-success" : "text-destructive"
                          )}>
                            {bet.prediction === "success" ? "succeed" : "fail"}
                          </span>
                        </div>
                        <span className="font-medium">{bet.pointsWagered} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
