"use client";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Filter, X, Clock, CheckCircle, XCircle, Layers } from "lucide-react";
import { cn } from "~/lib/utils";

export type WagerFilter = "all" | "active" | "completed" | "failed";
export type BetFilter = "all" | "pending" | "settled";

interface StatusFilterProps {
  value: WagerFilter | BetFilter;
  onChange: (value: WagerFilter | BetFilter) => void;
  type: "wager" | "bet";
  className?: string;
}

const wagerOptions = [
  { value: "all" as const, label: "All", icon: Layers },
  { value: "active" as const, label: "Active", icon: Clock },
  { value: "completed" as const, label: "Completed", icon: CheckCircle },
  { value: "failed" as const, label: "Failed", icon: XCircle },
];

const betOptions = [
  { value: "all" as const, label: "All", icon: Layers },
  { value: "pending" as const, label: "Pending", icon: Clock },
  { value: "settled" as const, label: "Settled", icon: CheckCircle },
];

export function StatusFilter({ value, onChange, type, className }: StatusFilterProps) {
  const options = type === "wager" ? wagerOptions : betOptions;
  const currentOption = options.find((o) => o.value === value);
  const isFiltered = value !== "all";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isFiltered ? "outline" : "ghost"}
          size="sm"
          className={cn(
            "gap-2 shrink-0",
            isFiltered && "border-primary/50",
            className
          )}
        >
          <Filter className="size-4" />
          <span className="hidden sm:inline">
            {isFiltered ? currentOption?.label : "Filter"}
          </span>
          {isFiltered && (
            <span
              className="size-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] hover:bg-destructive transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChange("all");
              }}
            >
              <X className="size-2.5" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as WagerFilter | BetFilter)}
        >
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="gap-2"
              >
                <Icon className={cn(
                  "size-4",
                  option.value === "active" && "text-primary",
                  option.value === "pending" && "text-yellow-500",
                  option.value === "completed" && "text-success",
                  option.value === "settled" && "text-success",
                  option.value === "failed" && "text-destructive"
                )} />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
