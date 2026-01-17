"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckCircle className="size-4" />,
        info: <Info className="size-4" />,
        warning: <AlertTriangle className="size-4" />,
        error: <XCircle className="size-4" />,
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-card text-card-foreground border-border shadow-lg font-sans",
          title: "text-foreground font-medium",
          description: "text-muted-foreground",
          success: "!bg-success/10 !text-success !border-success/20",
          error: "!bg-destructive/10 !text-destructive !border-destructive/20",
          warning: "!bg-warning/10 !text-warning !border-warning/20",
          info: "!bg-primary/10 !text-primary !border-primary/20",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
