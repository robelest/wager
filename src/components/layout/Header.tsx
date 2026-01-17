"use client";

import { Link } from "@tanstack/react-router";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { UserMenu } from "~/components/auth/UserMenu";
import { useSession } from "~/lib/auth-client";
import { MenuIcon } from "~/components/ui/menu";
import { PlusIcon } from "~/components/ui/plus";
import { LayoutDashboard, Trophy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { data: session, isPending } = useSession();

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
              <nav className="mt-6 flex flex-col gap-2">
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
