"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Medal } from "lucide-react";

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string | null;
  completedWagers: number;
  totalWagers: number;
  successRate: number;
  rank: number;
}

interface PodiumProps {
  users: LeaderboardUser[];
  className?: string;
}

const rankConfig = [
  {
    position: 1,
    color: "text-amber-500",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-400",
    ringColor: "ring-amber-400",
    height: "h-40",
  },
  {
    position: 2,
    color: "text-slate-400",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
    ringColor: "ring-slate-300",
    height: "h-32",
  },
  {
    position: 3,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-400",
    ringColor: "ring-orange-400",
    height: "h-24",
  },
];

export function Podium({ users, className }: PodiumProps) {
  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = [users[1], users[0], users[2]].filter(Boolean);

  return (
    <div
      className={cn(
        "flex items-end justify-center gap-4 py-8 px-4",
        className
      )}
    >
      {podiumOrder.map((user, displayIndex) => {
        const actualRank = user.rank;
        const config = rankConfig.find((c) => c.position === actualRank)!;

        return (
          <div
            key={user.id}
            className="flex flex-col items-center animate-fade-in-up"
            style={{ animationDelay: `${displayIndex * 150}ms` }}
          >
            {/* User Card */}
            <div
              className={cn(
                "flex flex-col items-center rounded-sm border-2 p-4 sm:p-6 transition-all",
                "bg-card",
                config.borderColor,
                actualRank === 1 && "scale-105"
              )}
              style={{ width: actualRank === 1 ? "180px" : "150px" }}
            >
              {/* Medal */}
              <div className={cn("mb-3", config.color)}>
                <Medal
                  strokeWidth={1.5}
                  className={cn("size-8", actualRank === 1 && "size-10")}
                />
              </div>

              {/* Avatar */}
              <Avatar
                size={actualRank === 1 ? "lg" : "default"}
                className={cn("ring-2", config.ringColor)}
              >
                {user.avatar && <AvatarImage src={user.avatar} />}
                <AvatarFallback className="bg-background-secondary text-muted-foreground font-medium">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>

              {/* Name */}
              <p
                className={cn(
                  "mt-3 font-semibold text-center truncate w-full",
                  actualRank === 1 && "text-lg"
                )}
              >
                {user.name}
              </p>

              {/* Stats */}
              <div className="mt-3 flex gap-2">
                <Badge variant="outline" className="text-xs bg-background border-border">
                  {user.completedWagers}/{user.totalWagers}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs bg-success/10 text-success border-success/30"
                >
                  {user.successRate}%
                </Badge>
              </div>
            </div>

            {/* Podium Stand */}
            <div
              className={cn(
                "w-full rounded-t-lg mt-2 flex items-center justify-center font-bold text-2xl",
                config.bgColor,
                config.height,
                actualRank === 1 && "w-[120%]"
              )}
            >
              <span className={config.color}>{actualRank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
