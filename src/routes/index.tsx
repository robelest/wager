import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  HeroSection,
  LiveFeed,
  LeaderboardPreview,
} from "~/components/home";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    // Redirect authenticated users to dashboard
    if (context.isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <HeroSection />
      <LiveFeed />
      <LeaderboardPreview />
    </>
  );
}