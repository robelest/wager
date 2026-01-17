import { cn } from "~/lib/utils";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  withPadding?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export function PageWrapper({
  children,
  className,
  maxWidth = "xl",
  withPadding = true,
}: PageWrapperProps) {
  return (
    <main
      className={cn(
        "relative w-full h-[calc(100dvh-4rem)] overflow-y-auto",
        withPadding && "px-4 py-6 sm:px-6 lg:px-8",
        className
      )}
    >
      {/* Grid pattern background */}
      <div
        className="fixed inset-0 top-16 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)`,
          backgroundSize: "4rem 4rem",
        }}
      />
      <div className={cn("relative mx-auto w-full", maxWidthClasses[maxWidth])}>
        {children}
      </div>
    </main>
  );
}
