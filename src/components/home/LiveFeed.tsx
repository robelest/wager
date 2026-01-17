"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { ActivityIcon } from "~/components/ui/activity";
import { Clock } from "lucide-react";

interface LiveFeedProps {
  className?: string;
}

const statusConfig = {
  active: {
    label: "Active",
    className: "badge-active",
  },
  completed: {
    label: "Success",
    className: "badge-success",
  },
  failed: {
    label: "Failed",
    className: "badge-failed",
  },
  pending: {
    label: "Pending",
    className: "badge-active",
  },
  cancelled: {
    label: "Cancelled",
    className: "badge-failed",
  },
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function WagerSkeleton() {
  return (
    <div className="border border-border p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-14 rounded-sm" />
          </div>
          <Skeleton className="h-4 w-full max-w-[200px] mb-1" />
          <Skeleton className="h-3 w-full max-w-[150px]" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

function EmptyState() {
  return <div className="h-[300px]" />;
}

export function LiveFeed({ className }: LiveFeedProps) {
  const recentWagers = useQuery(api.wagers.getRecentWagers, { limit: 5 });
  const isLoading = recentWagers === undefined;

  return (
    <section className={cn("py-20 sm:py-28 bg-background relative overflow-hidden", className)}>
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)`,
          backgroundSize: "4rem 4rem",
        }}
      />
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Live Feed */}
          <Card className="border border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ActivityIcon size={20} className="text-primary" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-sm bg-success" />
                </div>
                <CardTitle>Live Feed</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs rounded-sm">
                Real-time
              </Badge>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {isLoading ? (
                    <>
                      <WagerSkeleton />
                      <WagerSkeleton />
                      <WagerSkeleton />
                      <WagerSkeleton />
                      <WagerSkeleton />
                    </>
                  ) : recentWagers.length === 0 ? (
                    <EmptyState />
                  ) : (
                    recentWagers.map((wager, index) => {
                      const status = wager.status as keyof typeof statusConfig;
                      const config = statusConfig[status] || statusConfig.active;

                      return (
                        <div
                          key={wager._id}
                          className={cn(
                            "border border-border group relative p-4 transition-colors",
                            "hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar size="sm">
                              {wager.user?.avatar && (
                                <AvatarImage src={wager.user.avatar} />
                              )}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {wager.user?.name
                                  ? wager.user.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                  : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">
                                  {wager.user?.name || "Anonymous"}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    config.className
                                  )}
                                >
                                  {config.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-foreground line-clamp-1">
                                {wager.task}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                Consequence: {wager.consequence}
                              </p>
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="size-3 mr-1" />
                              {formatTimeAgo(wager.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* How to Get Started */}
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Get Started in 3 Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <Step
                  number={1}
                  title="Connect Discord"
                  description="Sign in with Discord to link your account. Add our bot to your server."
                />
                <Step
                  number={2}
                  title="Make a Wager"
                  description="Declare what you'll accomplish and what happens if you fail. Be specific."
                />
                <Step
                  number={3}
                  title="Submit Proof"
                  description="When you complete your task, submit photo proof. AI verifies your success."
                />
              </div>

              <div className="mt-8 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm text-foreground">
                  <span className="font-semibold text-primary">Pro tip:</span>{" "}
                  The more specific your task and consequence, the better the AI
                  can verify your success.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary font-bold border border-primary/20">
        {number}
      </div>
      <div>
        <h4 className="font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
