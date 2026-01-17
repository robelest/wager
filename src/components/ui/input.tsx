import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "~/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "dark:bg-input border-input focus-visible:border-ring focus-visible:ring-ring aria-invalid:ring-destructive aria-invalid:border-destructive h-9 rounded-sm border bg-transparent px-2.5 py-1 text-base transition-[color,box-shadow] file:h-7 file:text-sm file:font-medium focus-visible:ring-[2px] aria-invalid:ring-[2px] md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
