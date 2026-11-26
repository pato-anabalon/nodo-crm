"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The mark beside somebody with a shift to look at, and what it means. Radix
 * opens a tooltip on hover and focus but not on a tap, and on a phone the
 * timesheet is a list of cards read by touch — so a tap toggles it too.
 */
export function FlagHint({ label }: { label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={() => setOpen((value) => !value)}
            className="ml-1.5 inline-flex align-[-2px] text-[var(--status-viewing)]"
          >
            <AlertTriangle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={4} className="max-w-64">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
