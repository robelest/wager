"use client";

import { Link } from "@tanstack/react-router";
import { ArrowRight, Zap, Users, Trophy } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { useSession } from "~/lib/auth-client";
import { SignInButton } from "~/components/auth/SignInButton";
import { cn } from "~/lib/utils";

interface HeroSectionProps {
  className?: string;
}

export function HeroSection({ className }: HeroSectionProps) {
  const { data: session } = useSession();
  const globalStats = useQuery(api.wagers.getGlobalStats);

  // Format numbers for display
  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return "—";
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return num.toLocaleString();
  };

  return (
    <section
      className={cn(
        "relative min-h-[90vh] overflow-hidden bg-background",
        className
      )}
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)`,
          backgroundSize: "4rem 4rem",
        }}
      />

      <div className="container relative z-10 pt-32 pb-20 mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          {/* Live stats badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium rounded-sm border border-border bg-secondary text-secondary-foreground">
            <span className="w-2 h-2 bg-accent rounded-sm" />
            {globalStats?.activeWagersCount ?? "—"} active wagers right now
          </div>

          {/* Hero headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            <span className="text-foreground">Put Your</span>
            <br />
            <span className="text-gradient-warm">Money</span>
            <br />
            <span className="text-foreground">Where Your</span>
            <br />
            <span className="text-gradient-warm">Mouth Is</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-xl mb-10 leading-relaxed">
            Make a commitment. Set the stakes. Get it done—or face the
            consequences.
            <span className="text-foreground font-medium">
              {" "}
              Accountability that actually works.
            </span>
          </p>

          {/* CTA Button */}
          {session ? (
            <Link to="/dashboard">
              <Button
                size="lg"
                className="text-lg px-8 py-6"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          ) : (
            <SignInButton
              size="lg"
              className="text-lg px-8 py-6"
            />
          )}

          {/* Social proof stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-border">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-3xl font-bold text-foreground">
                  {formatNumber(globalStats?.totalUsers)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-accent" />
                <span className="text-3xl font-bold text-foreground">
                  {globalStats?.successRate !== undefined
                    ? `${Math.round(globalStats.successRate)}%`
                    : "—%"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-warning" />
                <span className="text-3xl font-bold text-foreground">
                  {formatNumber(globalStats?.completedWagers)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Wagers Completed</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
