"use client";

import { useState } from "react";
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
import {
  Target,
  AlertCircle,
  Server,
  Coins,
  Plus,
  Trash2,
  ListTodo,
} from "lucide-react";
import type { DiscordServer } from "./WagerForm";

interface Task {
  description: string;
  deadlineHours: number;
}

export interface MultiTaskWagerFormData {
  guildId: string;
  title: string;
  consequence: string;
  tasks: Task[];
}

interface MultiTaskWagerFormProps {
  onSubmit: (data: MultiTaskWagerFormData) => Promise<void>;
  isSubmitting?: boolean;
  servers: DiscordServer[];
  isLoadingServers?: boolean;
}

const steps = [
  { id: "server", title: "Server", icon: "server" },
  { id: "title", title: "Wager Title", icon: "target" },
  { id: "tasks", title: "Tasks", icon: "list" },
  { id: "consequence", title: "The Stakes", icon: "alert" },
  { id: "confirm", title: "Confirm", icon: "check" },
] as const;

const deadlinePresets = [
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "72h", hours: 72 },
  { label: "1 week", hours: 168 },
];

export function MultiTaskWagerForm({
  onSubmit,
  isSubmitting = false,
  servers,
  isLoadingServers = false,
}: MultiTaskWagerFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<MultiTaskWagerFormData>({
    guildId: "",
    title: "",
    consequence: "",
    tasks: [
      { description: "", deadlineHours: 24 },
      { description: "", deadlineHours: 48 },
    ],
  });

  const progress = ((currentStep + 1) / steps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.guildId.length > 0;
      case 1:
        return formData.title.length >= 5 && formData.title.length <= 100;
      case 2:
        return (
          formData.tasks.length >= 2 &&
          formData.tasks.every(
            (t) =>
              t.description.length >= 5 &&
              t.description.length <= 150 &&
              t.deadlineHours >= 1 &&
              t.deadlineHours <= 168
          )
        );
      case 3:
        return (
          formData.consequence.length >= 10 && formData.consequence.length <= 200
        );
      case 4:
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
    await onSubmit(formData);
  };

  const addTask = () => {
    if (formData.tasks.length < 10) {
      const lastTaskHours = formData.tasks[formData.tasks.length - 1]?.deadlineHours || 24;
      setFormData({
        ...formData,
        tasks: [...formData.tasks, { description: "", deadlineHours: Math.min(lastTaskHours + 24, 168) }],
      });
    }
  };

  const removeTask = (index: number) => {
    if (formData.tasks.length > 2) {
      setFormData({
        ...formData,
        tasks: formData.tasks.filter((_, i) => i !== index),
      });
    }
  };

  const updateTask = (index: number, field: keyof Task, value: string | number) => {
    const newTasks = [...formData.tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setFormData({ ...formData, tasks: newTasks });
  };

  const selectedServer = servers.find((s) => s.guildId === formData.guildId);

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
                  index < currentStep &&
                    "bg-primary border-primary text-primary-foreground",
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
              <span className="hidden sm:inline text-sm font-medium">
                {step.title}
              </span>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Which Discord server should this wager be posted to?</Label>
                {isLoadingServers ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : servers.length === 0 ? (
                  <div className="rounded-sm border border-warning/20 bg-warning/5 p-4 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No Discord servers found. Add the Wager bot to a server to
                      get started.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `https://discord.com/oauth2/authorize?client_id=${import.meta.env.PUBLIC_DISCORD_CLIENT_ID}&permissions=277025467456&scope=bot%20applications.commands`,
                          "_blank"
                        )
                      }
                      className="gap-2"
                    >
                      <Server className="size-4" />
                      Add Bot to Server
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {servers.map((server) => (
                      <button
                        key={server.guildId}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, guildId: server.guildId })
                        }
                        className={cn(
                          "flex items-center justify-between p-4 rounded-sm border transition-all text-left",
                          formData.guildId === server.guildId
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
            </div>
          )}

          {/* Step 1: Wager Title */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">What's your overall goal?</Label>
                <Input
                  id="title"
                  placeholder="e.g., Read 5 books this month"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="text-lg"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>A short description of your multi-task goal</span>
                  <span
                    className={cn(formData.title.length > 100 && "text-destructive")}
                  >
                    {formData.title.length}/100
                  </span>
                </div>
              </div>
              <div className="rounded-sm border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm">
                  <span className="font-semibold text-primary">Tip:</span> This
                  title will be shown as the main wager. Each individual task
                  will have its own deadline.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Tasks */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Add your individual tasks</Label>
                <p className="text-sm text-muted-foreground">
                  Each task has its own deadline. Complete all tasks to succeed!
                </p>
              </div>

              <div className="space-y-3">
                {formData.tasks.map((task, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-sm border border-border/50 bg-muted/30"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder={`Task ${index + 1}: e.g., Read "Atomic Habits"`}
                        value={task.description}
                        onChange={(e) =>
                          updateTask(index, "description", e.target.value)
                        }
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Deadline:
                        </span>
                        <div className="flex gap-1">
                          {deadlinePresets.map((preset) => (
                            <Button
                              key={preset.hours}
                              type="button"
                              size="sm"
                              variant={
                                task.deadlineHours === preset.hours
                                  ? "default"
                                  : "outline"
                              }
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                updateTask(index, "deadlineHours", preset.hours)
                              }
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          value={task.deadlineHours}
                          onChange={(e) =>
                            updateTask(
                              index,
                              "deadlineHours",
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="h-7 w-16 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">hrs</span>
                      </div>
                    </div>
                    {formData.tasks.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeTask(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {formData.tasks.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTask}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  Add Task
                </Button>
              )}

              <div className="rounded-sm border border-warning/20 bg-warning/5 p-4">
                <p className="text-sm">
                  <span className="font-semibold text-warning">Remember:</span>{" "}
                  All tasks must be completed for the wager to succeed. If any
                  task fails, the entire wager fails.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Consequence */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="consequence">What happens if you fail?</Label>
                <Textarea
                  id="consequence"
                  placeholder="e.g., Donate $50 to a charity of my choice"
                  value={formData.consequence}
                  onChange={(e) =>
                    setFormData({ ...formData, consequence: e.target.value })
                  }
                  className="min-h-[120px] resize-none"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Make it meaningful but achievable</span>
                  <span
                    className={cn(
                      formData.consequence.length > 200 && "text-destructive"
                    )}
                  >
                    {formData.consequence.length}/200
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <MultiTaskWagerPreview
                serverName={selectedServer?.guildName || "Unknown Server"}
                title={formData.title}
                tasks={formData.tasks}
                consequence={formData.consequence}
              />

              <div className="rounded-sm border border-warning/20 bg-warning/5 p-4">
                <p className="text-sm">
                  <span className="font-semibold text-warning">Warning:</span>{" "}
                  Once created, this wager will be publicly visible on{" "}
                  <span className="font-medium">
                    {selectedServer?.guildName}
                  </span>
                  . Make sure you're ready to commit!
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
                {isSubmitting ? "Creating..." : "Create Multi-Task Wager"}
                <CircleCheckIcon size={16} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepIcon({
  icon,
  className,
}: {
  icon: (typeof steps)[number]["icon"];
  className?: string;
}) {
  switch (icon) {
    case "server":
      return <Server className={cn("size-5", className)} />;
    case "target":
      return <Target className={cn("size-5", className)} />;
    case "list":
      return <ListTodo className={cn("size-5", className)} />;
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

function MultiTaskWagerPreview({
  serverName,
  title,
  tasks,
  consequence,
}: {
  serverName: string;
  title: string;
  tasks: Task[];
  consequence: string;
}) {
  const finalDeadline = Math.max(...tasks.map((t) => t.deadlineHours));

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Server className="h-3 w-3" />
            <span>{serverName}</span>
          </div>
          <span className="text-xs font-mono text-primary">
            {tasks.length} tasks | {finalDeadline}h max
          </span>
        </div>
        <h3 className="font-semibold">{title || "Your wager title"}</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Task List */}
        <div className="space-y-2">
          {tasks.map((task, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-sm rounded-sm bg-background/50 px-3 py-2"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">
                {index + 1}
              </div>
              <span className="flex-1 truncate">
                {task.description || `Task ${index + 1}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {task.deadlineHours}h
              </span>
            </div>
          ))}
        </div>

        {/* Consequence */}
        <div className="rounded-sm border border-border/50 bg-background/50 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertCircle className="size-3" />
            <span>If failed:</span>
          </div>
          <p className="text-sm">
            {consequence || "Your consequence will appear here"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
