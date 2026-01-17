"use client";

import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import { ArrowRightIcon } from "~/components/ui/arrow-right";
import { ArrowLeftIcon } from "~/components/ui/arrow-left";
import { CircleCheckIcon } from "~/components/ui/circle-check";
import { ClockIcon } from "~/components/ui/clock";
import { Target, AlertCircle, Server, Coins } from "lucide-react";
import { useState } from "react";

// Server type from Convex query
export interface DiscordServer {
  guildId: string;
  guildName: string;
  points: number;
  totalBets: number;
  correctBets: number;
}

const wagerSchema = z.object({
  guildId: z.string().min(1, "Please select a Discord server"),
  task: z
    .string()
    .min(10, "Task must be at least 10 characters")
    .max(200, "Task must be less than 200 characters"),
  consequence: z
    .string()
    .min(10, "Consequence must be at least 10 characters")
    .max(200, "Consequence must be less than 200 characters"),
  deadlineHours: z
    .number()
    .min(1, "Deadline must be at least 1 hour")
    .max(168, "Deadline must be less than 7 days"),
});

export type WagerFormData = z.infer<typeof wagerSchema>;

interface WagerFormProps {
  onSubmit: (data: WagerFormData) => Promise<void>;
  isSubmitting?: boolean;
  servers: DiscordServer[];
  isLoadingServers?: boolean;
}

const steps = [
  { id: "server", title: "Server", icon: "server" },
  { id: "task", title: "Your Task", icon: "target" },
  { id: "consequence", title: "The Stakes", icon: "alert" },
  { id: "deadline", title: "Deadline", icon: "clock" },
  { id: "confirm", title: "Confirm", icon: "check" },
] as const;

const deadlinePresets = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
];

export function WagerForm({
  onSubmit,
  isSubmitting = false,
  servers,
  isLoadingServers = false,
}: WagerFormProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm({
    defaultValues: {
      guildId: "",
      task: "",
      consequence: "",
      deadlineHours: 24,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  const progress = ((currentStep + 1) / steps.length) * 100;

  const canProceed = () => {
    const values = form.state.values;
    switch (currentStep) {
      case 0: // Server selection
        return values.guildId.length > 0;
      case 1: // Task
        return values.task.length >= 10 && values.task.length <= 200;
      case 2: // Consequence
        return values.consequence.length >= 10 && values.consequence.length <= 200;
      case 3: // Deadline
        return values.deadlineHours >= 1 && values.deadlineHours <= 168;
      case 4: // Confirm
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    await form.handleSubmit();
  };

  const selectedServer = servers.find((s) => s.guildId === form.state.values.guildId);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2",
                index <= currentStep ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                  index < currentStep && "bg-primary border-primary text-primary-foreground",
                  index === currentStep && "border-primary bg-primary/10",
                  index > currentStep && "border-muted"
                )}
              >
                {index < currentStep ? (
                  <CircleCheckIcon size={16} />
                ) : (
                  <StepIcon icon={step.icon} />
                )}
              </div>
              <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* Form Steps */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StepIcon icon={steps[currentStep].icon} className="text-primary" />
            {steps[currentStep].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step 0: Server Selection */}
          {currentStep === 0 && (
            <form.Field name="guildId">
              {(field) => (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Which Discord server should this wager be posted to?</Label>
                    {isLoadingServers ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      </div>
                    ) : servers.length === 0 ? (
                      <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          No Discord servers found. Make sure the Wager bot is installed in at least
                          one of your servers.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {servers.map((server) => (
                          <button
                            key={server.guildId}
                            type="button"
                            onClick={() => field.handleChange(server.guildId)}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-lg border transition-all text-left",
                              field.state.value === server.guildId
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border/50 hover:border-primary/50 hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <Server className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{server.guildName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {server.totalBets > 0
                                    ? `${server.correctBets}/${server.totalBets} bets won`
                                    : "No bets yet"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <Coins className="h-4 w-4 text-yellow-500" />
                              <span>{server.points} pts</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm">
                      <span className="font-semibold text-primary">Note:</span> Your wager will be
                      posted to the configured wagers channel in the selected server.
                    </p>
                  </div>
                </div>
              )}
            </form.Field>
          )}

          {/* Step 1: Task */}
          {currentStep === 1 && (
            <form.Field name="task">
              {(field) => (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="task">What will you accomplish?</Label>
                    <Textarea
                      id="task"
                      placeholder="e.g., Complete 30 pushups every morning for 7 days"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Be specific and measurable</span>
                      <span
                        className={cn(
                          field.state.value.length > 200 && "text-destructive"
                        )}
                      >
                        {field.state.value.length}/200
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm">
                      <span className="font-semibold text-primary">Tip:</span> The more specific
                      your task, the easier it is for AI to verify your proof.
                    </p>
                  </div>
                </div>
              )}
            </form.Field>
          )}

          {/* Step 2: Consequence */}
          {currentStep === 2 && (
            <form.Field name="consequence">
              {(field) => (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="consequence">What happens if you fail?</Label>
                    <Textarea
                      id="consequence"
                      placeholder="e.g., Donate $50 to a charity of my choice"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Make it meaningful but achievable</span>
                      <span
                        className={cn(
                          field.state.value.length > 200 && "text-destructive"
                        )}
                      >
                        {field.state.value.length}/200
                      </span>
                    </div>
                  </div>

                  {/* Severity indicator */}
                  <ConsequenceSeverity consequence={field.state.value} />
                </div>
              )}
            </form.Field>
          )}

          {/* Step 3: Deadline */}
          {currentStep === 3 && (
            <form.Field name="deadlineHours">
              {(field) => (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Quick Select</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {deadlinePresets.map((preset) => (
                        <Button
                          key={preset.hours}
                          type="button"
                          variant={field.state.value === preset.hours ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.handleChange(preset.hours)}
                          className={cn(
                            field.state.value === preset.hours && "glow-primary"
                          )}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customHours">Or set custom hours</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="customHours"
                        type="number"
                        min={1}
                        max={168}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || 1)}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">hours</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-4">
                    <p className="text-sm text-muted-foreground">
                      Your deadline will be:{" "}
                      <span className="font-medium text-foreground">
                        {formatDeadline(field.state.value)}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </form.Field>
          )}

          {/* Step 4: Confirm */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <WagerPreview
                serverName={selectedServer?.guildName || "Unknown Server"}
                task={form.state.values.task}
                consequence={form.state.values.consequence}
                deadlineHours={form.state.values.deadlineHours}
              />

              <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                <p className="text-sm">
                  <span className="font-semibold text-warning">Warning:</span> Once created, this
                  wager will be publicly visible on{" "}
                  <span className="font-medium">{selectedServer?.guildName}</span>. Make sure you're
                  ready to commit!
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 mt-6 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeftIcon size={16} />
              Back
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className="gap-2"
              >
                Next
                <ArrowRightIcon size={16} />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !canProceed()}
                className="gap-2 glow-primary"
              >
                {isSubmitting ? "Creating..." : "Create Wager"}
                <CircleCheckIcon size={16} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepIcon({ icon, className }: { icon: typeof steps[number]["icon"]; className?: string }) {
  switch (icon) {
    case "server":
      return <Server className={cn("size-5", className)} />;
    case "target":
      return <Target className={cn("size-5", className)} />;
    case "alert":
      return <AlertCircle className={cn("size-5", className)} />;
    case "clock":
      return <ClockIcon size={20} className={className} />;
    case "check":
      return <CircleCheckIcon size={20} className={className} />;
    default:
      return null;
  }
}

function ConsequenceSeverity({ consequence }: { consequence: string }) {
  // Simple heuristic for consequence severity
  const getSeverity = () => {
    const lower = consequence.toLowerCase();
    if (lower.includes("shave") || lower.includes("tattoo") || lower.includes("public"))
      return { level: "extreme", color: "bg-destructive", percent: 100 };
    if (lower.includes("donate") || lower.includes("pay") || lower.includes("buy"))
      return { level: "moderate", color: "bg-warning", percent: 60 };
    if (lower.includes("cold") || lower.includes("exercise") || lower.includes("no"))
      return { level: "mild", color: "bg-success", percent: 30 };
    return { level: "unknown", color: "bg-muted", percent: 0 };
  };

  const severity = getSeverity();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Severity Level</span>
        <span className="font-medium capitalize">{severity.level}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500", severity.color)}
          style={{ width: `${severity.percent}%` }}
        />
      </div>
    </div>
  );
}

function WagerPreview({
  serverName,
  task,
  consequence,
  deadlineHours,
}: {
  serverName: string;
  task: string;
  consequence: string;
  deadlineHours: number;
}) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Server className="h-3 w-3" />
            <span>{serverName}</span>
          </div>
          <span className="text-xs font-mono text-primary">{deadlineHours}h deadline</span>
        </div>
        <h3 className="font-semibold">{task || "Your task will appear here"}</h3>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border border-border/50 bg-background/50 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertCircle className="size-3" />
            <span>If failed:</span>
          </div>
          <p className="text-sm">{consequence || "Your consequence will appear here"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDeadline(hours: number) {
  const deadline = new Date(Date.now() + hours * 60 * 60 * 1000);
  return deadline.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
