"use client";

import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { Link } from "@tanstack/react-router";
import { ClockIcon } from "~/components/ui/clock";
import { CircleCheckIcon } from "~/components/ui/circle-check";
import { ArrowRightIcon } from "~/components/ui/arrow-right";
import { AlertCircle, XCircle, ImagePlus } from "lucide-react";

export interface Wager {
  _id: string;
  task: string;
  consequence: string;
  deadline: number;
  status: "pending" | "active" | "completed" | "failed" | "cancelled";
  createdAt: number;
  proofImageUrl?: string;
  verificationResult?: {
    passed: boolean;
    confidence: number;
    reasoning: string;
  };
}

interface WagerCardProps {
  wager: Wager;
  className?: string;
  showActions?: boolean;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: ClockIcon,
    className: "bg-muted text-muted-foreground border-muted",
    cardBorder: "border-muted",
    isAnimated: false,
  },
  active: {
    label: "Active",
    icon: ClockIcon,
    className: "bg-primary/10 text-primary border-primary",
    cardBorder: "border-primary",
    isAnimated: true,
  },
  completed: {
    label: "Completed",
    icon: CircleCheckIcon,
    className: "bg-success/10 text-success border-success",
    cardBorder: "border-success",
    isAnimated: true,
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive",
    cardBorder: "border-destructive",
    isAnimated: false,
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-muted text-muted-foreground border-muted",
    cardBorder: "border-muted",
    isAnimated: false,
  },
};

export function WagerCard({
  wager,
  className,
  showActions = true,
}: WagerCardProps) {
  const config = statusConfig[wager.status];
  const timeRemaining = getTimeRemaining(wager.deadline);
  const progress = getProgress(wager.createdAt, wager.deadline);
  const isUrgent = wager.status === "active" && timeRemaining.hours < 24;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border bg-card transition-colors",
        "hover:border-primary",
        wager.status !== "active" && config.cardBorder,
        isUrgent && "border-warning",
        className
      )}
    >
      {/* Status indicator bar */}
      <div
        className={cn(
          "absolute top-0 left-0 h-1 w-full",
          wager.status === "active" && "bg-primary",
          wager.status === "completed" && "bg-success",
          wager.status === "failed" && "bg-destructive"
        )}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
              {wager.task}
            </h3>
          </div>
          <Badge variant="outline" className={cn("shrink-0", config.className)}>
            {config.isAnimated ? (
              <config.icon size={12} className="mr-1" />
            ) : (
              <config.icon className="size-3 mr-1" />
            )}
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Consequence */}
        <div className="rounded-sm border border-border bg-background p-3 mb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertCircle className="size-3" />
            <span>If failed:</span>
          </div>
          <p className="text-sm text-foreground/90 line-clamp-2">{wager.consequence}</p>
        </div>

        {/* Time remaining / Progress */}
        {wager.status === "active" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Time remaining</span>
              <span
                className={cn(
                  "font-mono font-medium",
                  isUrgent ? "text-warning" : "text-foreground"
                )}
              >
                {formatTimeRemaining(timeRemaining)}
              </span>
            </div>
            <Progress
              value={progress}
              className={cn(
                "h-1.5",
                isUrgent && "[&>div]:bg-warning"
              )}
            />
          </div>
        )}

        {/* Verification result */}
        {wager.verificationResult && (
          <div
            className={cn(
              "rounded-sm p-3 mt-3",
              wager.verificationResult.passed
                ? "bg-success/10 border border-success"
                : "bg-destructive/10 border border-destructive"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {wager.verificationResult.passed ? (
                <CircleCheckIcon size={16} className="text-success" />
              ) : (
                <XCircle className="size-4 text-destructive" />
              )}
              <span className="text-sm font-medium">
                AI Verification: {wager.verificationResult.confidence}% confidence
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {wager.verificationResult.reasoning}
            </p>
          </div>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className="pt-0 gap-2">
          {wager.status === "active" && !wager.proofImageUrl && (
            <Link to="/wager/$wagerId" params={{ wagerId: wager._id }} className="flex-1">
              <Button variant="default" size="sm" className="w-full gap-2">
                <ImagePlus className="size-4" />
                Submit Proof
              </Button>
            </Link>
          )}
          <Link to="/wager/$wagerId" params={{ wagerId: wager._id }} className={wager.status === "active" && !wager.proofImageUrl ? "" : "flex-1"}>
            <Button
              variant={wager.status === "active" && !wager.proofImageUrl ? "outline" : "default"}
              size="sm"
              className={cn("gap-2", !(wager.status === "active" && !wager.proofImageUrl) && "w-full")}
            >
              View Details
              <ArrowRightIcon size={16} />
            </Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

function getTimeRemaining(deadline: number) {
  const now = Date.now();
  const diff = Math.max(0, deadline - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, total: diff };
}

function getProgress(createdAt: number, deadline: number) {
  const now = Date.now();
  const total = deadline - createdAt;
  const elapsed = now - createdAt;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function formatTimeRemaining({
  days,
  hours,
  minutes,
  total,
}: {
  days: number;
  hours: number;
  minutes: number;
  total: number;
}) {
  if (total === 0) return "Expired";
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
