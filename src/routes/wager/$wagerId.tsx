"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { PageWrapper } from "~/components/layout";
import { CountdownTimer, ProofUploader, BettingSection } from "~/components/wager";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon } from "~/components/ui/arrow-left";
import { CircleCheckIcon } from "~/components/ui/circle-check";
import { ClockIcon } from "~/components/ui/clock";
import { AlertCircle, XCircle, User, Calendar, Volume2, Server, Flag } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

// Helper to get display task (handles multi-task wagers)
function getWagerTask(wager: { task?: string; wagerTitle?: string }): string {
  return wager.task || wager.wagerTitle || "Unknown task";
}

// Helper to get deadline (handles multi-task wagers)
function getWagerDeadline(wager: { deadline?: number; finalDeadline?: number }): number {
  return wager.deadline || wager.finalDeadline || Date.now();
}

export const Route = createFileRoute("/wager/$wagerId")({
  component: WagerDetailPage,
});

const statusConfig = {
  active: {
    label: "Active",
    icon: "clock" as const,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  completed: {
    label: "Completed",
    icon: "check" as const,
    className: "bg-success/10 text-success border-success/20",
  },
  failed: {
    label: "Failed",
    icon: "x" as const,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  pending: {
    label: "Pending",
    icon: "clock" as const,
    className: "bg-muted/50 text-muted-foreground border-muted/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: "x" as const,
    className: "bg-muted/50 text-muted-foreground border-muted/20",
  },
};

function WagerDetailPage() {
  const { wagerId } = Route.useParams();
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  // Fetch wager with details
  const wagerData = useQuery(api.wagers.getWagerWithDetails, {
    wagerId: wagerId as Id<"wagers">,
  });
  const isLoading = wagerData === undefined;
  const wager = wagerData;
  const isOwner = wagerData?.isOwner ?? false;

  // Mutations for proof upload and forfeit
  const generateUploadUrl = useMutation(api.wagers.generateProofUploadUrl);
  const submitProof = useMutation(api.wagers.submitProofFromWeb);
  const forfeitWager = useMutation(api.wagers.forfeitWager);

  if (isLoading) {
    return <WagerDetailSkeleton />;
  }

  if (!wager) {
    return (
      <PageWrapper maxWidth="lg">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold">Wager Not Found</h1>
          <p className="text-muted-foreground mt-2">
            This wager doesn't exist or has been removed.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </PageWrapper>
    );
  }

  const config = statusConfig[wager.status as keyof typeof statusConfig];
  const userName = wager.user?.name || "Unknown User";
  const userAvatar = wager.user?.avatar;

  const handleForfeit = async () => {
    setIsForfeiting(true);
    try {
      await forfeitWager({ wagerId: wagerId as Id<"wagers"> });
      toast.success("Wager forfeited", {
        description: "This wager has been marked as failed.",
      });
      setShowForfeitConfirm(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      toast.error("Failed to forfeit", {
        description: errorMessage,
      });
    } finally {
      setIsForfeiting(false);
    }
  };

  const handleProofUpload = async (file: File) => {
    setIsUploading(true);
    try {
      // Step 1: Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload the file to Convex storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const { storageId } = await uploadResponse.json();

      // Step 3: Submit proof with storage ID
      await submitProof({
        wagerId: wagerId as Id<"wagers">,
        storageId,
      });

      toast.success("Proof submitted!", {
        description: "AI is now verifying your submission.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      toast.error("Upload failed", {
        description: errorMessage,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <PageWrapper maxWidth="lg">
      <div className="space-y-6">
        {/* Back link */}
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeftIcon size={16} />
            Back to Dashboard
          </Button>
        </Link>

        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-sm border border-border/50 bg-card/50 backdrop-blur-sm p-6 sm:p-8">
          {/* Status bar */}
          <div
            className={cn(
              "absolute top-0 left-0 h-1 w-full",
              wager.status === "active" && "bg-primary",
              wager.status === "completed" && "bg-success",
              wager.status === "failed" && "bg-destructive"
            )}
          />

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Avatar>
                {userAvatar && <AvatarImage src={userAvatar} />}
                <AvatarFallback className="bg-primary/20 text-primary">
                  {userName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{userName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {wager.server && (
                    <>
                      <Server className="size-3" />
                      <span>{wager.server.guildName}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>
                    Created{" "}
                    {new Date(wager.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className={cn("self-start", config.className)}>
              <StatusIcon icon={config.icon} className="mr-1 size-3" />
              {config.label}
            </Badge>
          </div>

          {/* Task */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">{wager.task}</h1>

          {/* Consequence */}
          <div className="rounded-sm border border-border/50 bg-background/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <AlertCircle className="size-4" />
              <span>If failed:</span>
            </div>
            <p className="text-foreground">{wager.consequence}</p>
          </div>

          {/* Forfeit Button - Only for owner of active wagers */}
          {wager.status === "active" && isOwner && (
            <div className="mt-4 pt-4 border-t border-border/30">
              {!showForfeitConfirm ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setShowForfeitConfirm(true)}
                >
                  <Flag className="size-4 mr-2" />
                  Give Up
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Are you sure? This counts as a failure.</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleForfeit}
                    disabled={isForfeiting}
                  >
                    {isForfeiting ? "Forfeiting..." : "Yes, Forfeit"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForfeitConfirm(false)}
                    disabled={isForfeiting}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Countdown Timer - Only for active wagers */}
        {wager.status === "active" && (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-base text-muted-foreground">Time Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <CountdownTimer deadline={getWagerDeadline(wager)} size="lg" />
            </CardContent>
          </Card>
        )}

        {/* Grid layout for main content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Proof Section */}
          {wager.status === "active" && isOwner && (
            <ProofUploader
              onUpload={handleProofUpload}
              isUploading={isUploading}
              currentProofUrl={wager.proofImageUrl}
              verificationFailed={wager.verificationResult ? !wager.verificationResult.passed : false}
            />
          )}

          {/* Betting Section */}
          {wager.guildId && (
            <BettingSection
              wagerId={wagerId as Id<"wagers">}
              guildId={wager.guildId}
              isOwner={isOwner}
              wagerStatus={wager.status}
            />
          )}

          {/* Verification Result */}
          {wager.verificationResult && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {wager.verificationResult.passed ? (
                    <CircleCheckIcon size={20} className="text-success" />
                  ) : (
                    <XCircle className="size-5 text-destructive" />
                  )}
                  AI Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "rounded-sm p-4",
                    wager.verificationResult.passed
                      ? "bg-success/10 border border-success/20"
                      : "bg-destructive/10 border border-destructive/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {wager.verificationResult.passed ? "Verified!" : "Not Verified"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        wager.verificationResult.passed
                          ? "text-success border-success/30"
                          : "text-destructive border-destructive/30"
                      )}
                    >
                      {wager.verificationResult.confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {wager.verificationResult.reasoning}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result Audio */}
          {wager.resultAudioUrl && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Volume2 className="size-5 text-primary" />
                  {wager.status === "completed" ? "Victory Speech" : "The Roast"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={cn(
                      "gap-2",
                      wager.status === "completed"
                        ? "glow-success bg-success hover:bg-success/80"
                        : "glow-destructive bg-destructive hover:bg-destructive/80"
                    )}
                  >
                    {isPlaying ? "Pause" : "Play Audio"}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    AI-generated audio response
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wager Info */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Wager Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow
                icon="user"
                label="Created by"
                value={userName}
              />
              <Separator className="bg-border/50" />
              <InfoRow
                icon="calendar"
                label="Created on"
                value={new Date(wager.createdAt).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              />
              <Separator className="bg-border/50" />
              <InfoRow
                icon="clock"
                label="Deadline"
                value={new Date(getWagerDeadline(wager)).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}

function StatusIcon({ icon, className }: { icon: "clock" | "check" | "x"; className?: string }) {
  switch (icon) {
    case "clock":
      return <ClockIcon size={12} className={className} />;
    case "check":
      return <CircleCheckIcon size={12} className={className} />;
    case "x":
      return <XCircle className={cn("size-3", className)} />;
    default:
      return null;
  }
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: "user" | "calendar" | "clock";
  label: string;
  value: string;
}) {
  const IconComponent = () => {
    switch (icon) {
      case "user":
        return <User className="size-4" />;
      case "calendar":
        return <Calendar className="size-4" />;
      case "clock":
        return <ClockIcon size={16} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconComponent />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function WagerDetailSkeleton() {
  return (
    <PageWrapper maxWidth="lg">
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-sm" />
        <Skeleton className="h-32" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </PageWrapper>
  );
}
