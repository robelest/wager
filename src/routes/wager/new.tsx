"use client";

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSession } from "~/lib/auth-client";
import { PageWrapper } from "~/components/layout";
import {
  WagerForm,
  MultiTaskWagerForm,
  type WagerFormData,
  type MultiTaskWagerFormData,
  type DiscordServer,
} from "~/components/wager";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon } from "~/components/ui/arrow-left";
import { Link } from "@tanstack/react-router";
import { useQuery, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { Target, ListTodo } from "lucide-react";

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
  const [wagerType, setWagerType] = useState<"single" | "multi">("single");

  // Query to get bot server IDs (for filtering)
  const botServerIds = useQuery(api.wagers.getBotServerIds);

  // Actions to create wagers
  const createWager = useAction(api.wagers.createWagerFromWeb);
  const createMultiTaskWager = useAction(api.wagers.createMultiTaskWagerFromWeb);

  // Action to get Discord access token
  const getDiscordToken = useAction(api.auth.getDiscordAccessToken);

  // Fetch Discord guilds client-side and filter to bot servers
  useEffect(() => {
    async function fetchServers() {
      // Wait for bot server IDs to load
      if (botServerIds === undefined) return;

      try {
        const botServerSet = new Set(botServerIds);

        // Get Discord access token from Convex (queries Better Auth account table)
        const tokenResult = await getDiscordToken();

        if (!tokenResult.accessToken) {
          console.error("Discord token error:", tokenResult.error);
          toast.error("Discord access unavailable", {
            description: tokenResult.error || "Please sign out and back in.",
          });
          setIsLoadingServers(false);
          return;
        }

        // Fetch user's guilds directly from Discord API
        const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
          headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch Discord guilds");
        }

        const guilds = await response.json();

        // Filter to only guilds where bot is installed
        const filteredServers: DiscordServer[] = guilds
          .filter((g: { id: string }) => botServerSet.has(g.id))
          .map((g: { id: string; name: string }) => ({
            guildId: g.id,
            guildName: g.name,
            points: 0,
            totalBets: 0,
            correctBets: 0,
          }));

        setServers(filteredServers);
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
  }, [botServerIds, getDiscordToken]);

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

  const handleMultiTaskSubmit = async (data: MultiTaskWagerFormData) => {
    setIsSubmitting(true);

    try {
      const result = await createMultiTaskWager({
        guildId: data.guildId,
        title: data.title,
        consequence: data.consequence,
        tasks: data.tasks,
      });

      toast.success("Multi-task wager created!", {
        description: `${data.tasks.length} tasks committed. Good luck!`,
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

        {/* Wager Type Tabs */}
        <Tabs
          value={wagerType}
          onValueChange={(v) => setWagerType(v as "single" | "multi")}
        >
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="single" className="gap-2">
              <Target className="size-4" />
              Single Task
            </TabsTrigger>
            <TabsTrigger value="multi" className="gap-2">
              <ListTodo className="size-4" />
              Multi-Task
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-6">
            <WagerForm
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              servers={servers}
              isLoadingServers={isLoadingServers}
            />
          </TabsContent>

          <TabsContent value="multi" className="mt-6">
            <MultiTaskWagerForm
              onSubmit={handleMultiTaskSubmit}
              isSubmitting={isSubmitting}
              servers={servers}
              isLoadingServers={isLoadingServers}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageWrapper>
  );
}
