"use client";

import { cn } from "~/lib/utils";

interface EmptyStateProps {
  className?: string;
}

export function EmptyState({ className }: EmptyStateProps) {
  return <div className={cn("py-16", className)} />;
}
