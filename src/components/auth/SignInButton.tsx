"use client";

import { Button, buttonVariants } from "~/components/ui/button";
import { signIn } from "~/lib/auth-client";
import { cn } from "~/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { DiscordIcon } from "~/components/ui/discord";

interface SignInButtonProps extends VariantProps<typeof buttonVariants> {
  className?: string;
  children?: React.ReactNode;
}

export function SignInButton({
  className,
  variant = "default",
  size = "default",
  children,
}: SignInButtonProps) {
  const handleSignIn = async () => {
    await signIn.social({
      provider: "discord",
      callbackURL: "/dashboard",
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSignIn}
      className={cn("gap-2", className)}
    >
      <DiscordIcon size={16} />
      {children || "Sign in with Discord"}
    </Button>
  );
}
