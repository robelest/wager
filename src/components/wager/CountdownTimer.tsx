"use client";

import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

interface CountdownTimerProps {
  deadline: number;
  className?: string;
  size?: "default" | "lg";
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function CountdownTimer({
  deadline,
  className,
  size = "default",
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft(deadline));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(deadline));
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const isExpired = timeLeft.total <= 0;
  const isUrgent = timeLeft.total > 0 && timeLeft.days === 0 && timeLeft.hours < 24;
  const isCritical = timeLeft.total > 0 && timeLeft.days === 0 && timeLeft.hours < 6;

  if (isExpired) {
    return (
      <div
        className={cn(
          "text-center",
          size === "lg" ? "py-8" : "py-4",
          className
        )}
      >
        <p className="text-destructive font-bold text-xl">Time's Up!</p>
        <p className="text-muted-foreground text-sm mt-1">Deadline has passed</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 sm:gap-4",
        isCritical && "animate-glow-pulse",
        className
      )}
    >
      <TimeUnit
        value={timeLeft.days}
        label="Days"
        size={size}
        isUrgent={isUrgent}
        isCritical={isCritical}
      />
      <TimeSeparator size={size} />
      <TimeUnit
        value={timeLeft.hours}
        label="Hours"
        size={size}
        isUrgent={isUrgent}
        isCritical={isCritical}
      />
      <TimeSeparator size={size} />
      <TimeUnit
        value={timeLeft.minutes}
        label="Min"
        size={size}
        isUrgent={isUrgent}
        isCritical={isCritical}
      />
      <TimeSeparator size={size} />
      <TimeUnit
        value={timeLeft.seconds}
        label="Sec"
        size={size}
        isUrgent={isUrgent}
        isCritical={isCritical}
      />
    </div>
  );
}

function TimeUnit({
  value,
  label,
  size,
  isUrgent,
  isCritical,
}: {
  value: number;
  label: string;
  size: "default" | "lg";
  isUrgent: boolean;
  isCritical: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "rounded-lg border border-border/50 bg-background/50 font-mono font-bold tabular-nums",
          size === "lg"
            ? "text-4xl sm:text-5xl px-4 py-3 min-w-[80px] sm:min-w-[100px]"
            : "text-2xl sm:text-3xl px-3 py-2 min-w-[60px] sm:min-w-[72px]",
          !isUrgent && "text-foreground",
          isUrgent && !isCritical && "text-warning border-warning/30",
          isCritical && "text-destructive border-destructive/30 animate-pulse"
        )}
      >
        {value.toString().padStart(2, "0")}
      </div>
      <span
        className={cn(
          "text-muted-foreground mt-1",
          size === "lg" ? "text-sm" : "text-xs"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function TimeSeparator({ size }: { size: "default" | "lg" }) {
  return (
    <span
      className={cn(
        "text-muted-foreground font-bold pb-5",
        size === "lg" ? "text-4xl" : "text-2xl"
      )}
    >
      :
    </span>
  );
}

function calculateTimeLeft(deadline: number): TimeLeft {
  const now = Date.now();
  const diff = Math.max(0, deadline - now);

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    total: diff,
  };
}
