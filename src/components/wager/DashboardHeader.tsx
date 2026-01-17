"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { FlameIcon } from "~/components/ui/flame";

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface UserStats {
  totalWagers: number;
  completedWagers: number;
  failedWagers: number;
  currentStreak: number;
  longestStreak: number;
}

interface DashboardHeaderProps {
  user: User;
  stats: UserStats;
  className?: string;
}

export function DashboardHeader({ user, stats, className }: DashboardHeaderProps) {
  const successRate =
    stats.totalWagers > 0
      ? Math.round((stats.completedWagers / stats.totalWagers) * 100)
      : 0;

  return (
    <div className={cn("flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between", className)}>
      {/* User info */}
      <div className="flex items-center gap-4">
        <Avatar size="lg">
          {user.image && <AvatarImage src={user.image} alt={user.name || ""} />}
          <AvatarFallback className="bg-muted text-muted-foreground font-medium">
            {user.name
              ? user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-semibold">{user.name?.split(" ")[0] || "User"}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {stats.currentStreak > 0 && (
              <span className="flex items-center gap-1">
                <FlameIcon size={14} className="text-orange-500" />
                {stats.currentStreak} day streak
              </span>
            )}
            {stats.currentStreak > 0 && successRate >= 80 && stats.totalWagers >= 5 && (
              <span>·</span>
            )}
            {successRate >= 80 && stats.totalWagers >= 5 && (
              <span>{successRate}% success rate</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="hidden sm:flex items-center gap-6">
        <StatItem label="Total" value={stats.totalWagers} />
        <StatItem label="Won" value={stats.completedWagers} className="text-success" />
        <StatItem label="Lost" value={stats.failedWagers} className="text-destructive" />
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="text-center">
      <p className={cn("text-2xl font-bold", className)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
