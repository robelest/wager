"use client";

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSession } from "~/lib/auth-client";
import { PageWrapper } from "~/components/layout";
import { WagerForm, type WagerFormData, type DiscordServer } from "~/components/wager";
import { Button } from "~/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon } from "~/components/ui/arrow-left";
import { Link } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";

export const Route = createFileRoute("/wager/new")({
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: NewWagerPage,
});

function NewWagerPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(true);

  // Action to fetch user's Discord servers (filtered to ones they're in)
  const getMyServers = useAction(api.wagers.getMyServers);

  // Mutation to create wager
  const createWager = useMutation(api.wagers.createWagerFromWeb);

  // Fetch servers on mount
  useEffect(() => {
    async function fetchServers() {
      try {
        const result = await getMyServers();
        setServers(result);
      } catch (error) {
        console.error("Failed to fetch servers:", error);
        toast.error("Failed to load servers", {
          description: "Please try refreshing the page.",
        });
      } finally {
        setIsLoadingServers(false);
      }
    }
    fetchServers();
  }, [getMyServers]);

  if (!session?.user) {
    return null;
  }

  const handleSubmit = async (data: WagerFormData) => {
    setIsSubmitting(true);

    try {
      const result = await createWager({
        guildId: data.guildId,
        task: data.task,
        consequence: data.consequence,
        deadlineHours: data.deadlineHours,
      });

      toast.success("Wager created successfully!", {
        description: "Your commitment has been posted to Discord.",
      });

      // Navigate to the new wager's detail page
      navigate({ to: "/wager/$wagerId", params: { wagerId: result.wagerId } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again later.";
      toast.error("Failed to create wager", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper maxWidth="lg">
      <div className="space-y-6">
        {/* Back link */}
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeftIcon size={16} />
            Back to Dashboard
          </Button>
        </Link>

        {/* Page header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Create New Wager</h1>
          <p className="text-muted-foreground">
            Set a task, define the stakes, and commit publicly. No going back.
          </p>
        </div>

        {/* Form */}
        <WagerForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          servers={servers}
          isLoadingServers={isLoadingServers}
        />
      </div>
    </PageWrapper>
  );
}
