"use client";

import { Link } from "@tanstack/react-router";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { UserMenu } from "~/components/auth/UserMenu";
import { useSession } from "~/lib/auth-client";
import { MenuIcon } from "~/components/ui/menu";
import { PlusIcon } from "~/components/ui/plus";
import { LayoutDashboard, Trophy, Coins } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ChevronDown, Server } from "lucide-react";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { data: session, isPending } = useSession();
  const totalPoints = useQuery(api.bets.getMyTotalPoints);

  // Only show header for authenticated users
  if (isPending || !session?.user) {
    return null;
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full bg-background/95 backdrop-blur-sm border-b border-border",
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <Link to="/dashboard">
            {({ isActive }) => (
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2",
                  isActive && "bg-primary/10 text-primary"
                )}
              >
                <LayoutDashboard className="size-4" />
                Dashboard
              </Button>
            )}
          </Link>
          <Link to="/leaderboard">
            {({ isActive }) => (
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2",
                  isActive && "bg-primary/10 text-primary"
                )}
              >
                <Trophy className="size-4" />
                Leaderboard
              </Button>
            )}
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Points Balance */}
          {totalPoints && totalPoints.total > 0 && (
            <PointsDisplay
              total={totalPoints.total}
              servers={totalPoints.servers}
            />
          )}

          {/* Create Wager CTA */}
          <Link to="/wager/new" className="hidden sm:block">
            <Button size="sm" className="gap-2">
              <PlusIcon size={16} />
              <span className="hidden lg:inline">New Wager</span>
            </Button>
          </Link>

          {/* User Menu */}
          <UserMenu user={session.user} />

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger
              className="inline-flex items-center justify-center h-9 w-9 rounded-md text-foreground hover:bg-muted transition-colors md:hidden"
            >
              <MenuIcon size={20} />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>

              {/* Mobile Points Balance */}
              {totalPoints && totalPoints.total > 0 && (
                <div className="mt-4">
                  <MobilePointsDisplay
                    total={totalPoints.total}
                    servers={totalPoints.servers}
                  />
                </div>
              )}

              <nav className="mt-4 flex flex-col gap-2">
                <Link to="/dashboard">
                  {({ isActive }) => (
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3",
                        isActive && "bg-primary/10 text-primary"
                      )}
                    >
                      <LayoutDashboard className="size-4" />
                      Dashboard
                    </Button>
                  )}
                </Link>
                <Link to="/leaderboard">
                  {({ isActive }) => (
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3",
                        isActive && "bg-primary/10 text-primary"
                      )}
                    >
                      <Trophy className="size-4" />
                      Leaderboard
                    </Button>
                  )}
                </Link>
                <Link to="/wager/new">
                  <Button className="mt-4 w-full gap-2">
                    <PlusIcon size={16} />
                    New Wager
                  </Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

interface ServerPoints {
  guildId: string;
  guildName: string;
  points: number;
}

interface PointsDisplayProps {
  total: number;
  servers: ServerPoints[];
}

function PointsDisplay({ total, servers }: PointsDisplayProps) {
  // Single server - show points directly without dropdown
  if (servers.length <= 1) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-yellow-500/10 border border-yellow-500/20">
        <Coins className="size-4 text-yellow-500" />
        <span className="text-sm font-medium text-yellow-500">
          {total.toLocaleString()}
        </span>
      </div>
    );
  }

  // Multiple servers - show dropdown with breakdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors">
          <Coins className="size-4 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-500">
            {total.toLocaleString()}
          </span>
          <ChevronDown className="size-3 text-yellow-500/70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
            <Server className="size-4" />
            Points by Server
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="p-2 space-y-2">
          {servers.map((server) => (
            <div
              key={server.guildId}
              className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/50"
            >
              <span className="text-sm truncate max-w-[140px]">
                {server.guildName}
              </span>
              <span className="text-sm font-medium text-yellow-500">
                {server.points.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobilePointsDisplay({ total, servers }: PointsDisplayProps) {
  // Single server - show simple display
  if (servers.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-yellow-500/10 border border-yellow-500/20">
        <Coins className="size-4 text-yellow-500" />
        <span className="text-sm font-medium text-yellow-500">
          {total.toLocaleString()} pts
        </span>
      </div>
    );
  }

  // Multiple servers - show expandable list
  return (
    <div className="rounded-sm border border-yellow-500/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/10">
        <Coins className="size-4 text-yellow-500" />
        <span className="text-sm font-medium text-yellow-500">
          {total.toLocaleString()} pts total
        </span>
      </div>
      <div className="p-2 space-y-1 bg-muted/30">
        {servers.map((server) => (
          <div
            key={server.guildId}
            className="flex items-center justify-between px-2 py-1 text-xs"
          >
            <span className="text-muted-foreground truncate max-w-[140px]">
              {server.guildName}
            </span>
            <span className="font-medium text-yellow-500">
              {server.points.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
