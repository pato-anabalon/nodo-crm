"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // `richColors` is what gives a success toast its own colour at all
          // — sonner's own green otherwise, a pale wash in light mode and a
          // near-black one in dark, both of which read as barely distinct
          // from the page behind them. `--primary`/`--primary-foreground`
          // are the same pair `BrandTheme` sets per company (and already a
          // readable pair by construction, see `inkOn`), so this is the
          // company's own colour rather than a fixed green or a second
          // brand colour to maintain.
          "--success-bg": "var(--primary)",
          "--success-text": "var(--primary-foreground)",
          "--success-border": "var(--primary)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
