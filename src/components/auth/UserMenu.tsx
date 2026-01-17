"use client";

import { signOut } from "~/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

interface UserType {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface UserMenuProps {
  user: UserType;
}

export function UserMenu({ user }: UserMenuProps) {
  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0]?.toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group relative h-10 w-10 rounded-full ring-2 ring-border/60 hover:ring-primary/60 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm hover:shadow-md">
        <Avatar size="default" className="h-10 w-10">
          {user.image && <AvatarImage src={user.image} alt={user.name || ""} className="object-cover" />}
          <AvatarFallback className="bg-gradient-to-br from-primary/25 to-accent/20 text-primary font-display font-semibold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 p-0 overflow-hidden border-border/50 shadow-xl"
      >
        {/* User Info Header */}
        <DropdownMenuGroup>
          <div className="px-3 py-3 border-b border-border/30">
            <div className="flex items-center gap-3">
              <Avatar size="default" className="h-9 w-9 ring-1 ring-border/50">
                {user.image && <AvatarImage src={user.image} alt={user.name || ""} className="object-cover" />}
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/15 text-primary font-display font-semibold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-display font-medium text-sm text-foreground truncate">
                  {user.name || "User"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {user.email}
                </span>
              </div>
            </div>
          </div>
          <DropdownMenuLabel className="sr-only">User Account</DropdownMenuLabel>
        </DropdownMenuGroup>

        {/* Sign Out */}
        <DropdownMenuGroup>
          <div className="p-1.5">
            <DropdownMenuItem
              onClick={handleSignOut}
              variant="destructive"
              className="cursor-pointer rounded-md px-3 py-2 gap-2 transition-colors duration-150"
            >
              <LogOut className="size-4" />
              <span className="font-medium text-sm">Sign out</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
