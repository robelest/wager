"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { FlameIcon } from "~/components/ui/flame";
import { BarChart3, Target, Trophy } from "lucide-react";

interface UserStats {
  totalWagers: number;
  completedWagers: number;
  failedWagers: number;
  currentStreak: number;
  longestStreak: number;
}

interface StatsPanelProps {
  stats: UserStats;
  className?: string;
}

export function StatsPanel({ stats, className }: StatsPanelProps) {
  const successRate =
    stats.totalWagers > 0
      ? Math.round((stats.completedWagers / stats.totalWagers) * 100)
      : 0;

  const activeWagers = stats.totalWagers - stats.completedWagers - stats.failedWagers;

  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-5 text-primary" />
          Your Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Rate Ring */}
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <svg className="size-32 -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                className="stroke-muted"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-primary transition-all duration-500"
                strokeDasharray={`${successRate * 2.51} 251`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{successRate}%</span>
              <span className="text-xs text-muted-foreground">Success Rate</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatBox
            icon={Target}
            label="Total Wagers"
            value={stats.totalWagers}
            iconColor="text-primary"
          />
          <StatBox
            icon={Trophy}
            label="Completed"
            value={stats.completedWagers}
            iconColor="text-success"
          />
          <StatBoxAnimated
            label="Current Streak"
            value={stats.currentStreak}
            suffix="days"
            iconColor="text-orange-400"
          />
          <StatBoxAnimated
            label="Best Streak"
            value={stats.longestStreak}
            suffix="days"
            iconColor="text-yellow-400"
          />
        </div>

        {/* Active Wagers Progress */}
        {stats.totalWagers > 0 && (
          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Win/Loss Ratio</span>
              <span className="font-medium">
                {stats.completedWagers} / {stats.failedWagers}
              </span>
            </div>
            <Progress
              value={(stats.completedWagers / stats.totalWagers) * 100}
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{activeWagers} active</span>
              <span>{stats.failedWagers} failed</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  suffix,
  iconColor,
}: {
  icon: typeof Target;
  label: string;
  value: number;
  suffix?: string;
  iconColor: string;
}) {
  return (
    <div className="border border-border bg-background p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("size-4", iconColor)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold">
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function StatBoxAnimated({
  label,
  value,
  suffix,
  iconColor,
}: {
  label: string;
  value: number;
  suffix?: string;
  iconColor: string;
}) {
  return (
    <div className="border border-border bg-background p-3">
      <div className="flex items-center gap-2 mb-2">
        <FlameIcon size={16} className={iconColor} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold">
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
