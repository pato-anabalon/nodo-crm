import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

/**
 * A shift's flags, on its line in the week and on its own page. The ones that
 * ask somebody to look (`needsReview`) are amber, the colour of the mark beside
 * the person on the week, so the shift that raised it is found at a glance;
 * the rest — travel, entered by hand, corrected — only describe it.
 */
export function ShiftFlagBadges({ flags, className }: { flags: { label: string; review: boolean }[]; className?: string }) {
  if (flags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {flags.map((flag) => (
        <Badge
          key={flag.label}
          variant="outline"
          className={cn(
            "font-normal",
            flag.review && "border-[color-mix(in_oklab,var(--status-viewing)_45%,transparent)] text-[var(--status-viewing)]",
          )}
        >
          {flag.label}
        </Badge>
      ))}
    </div>
  );
}
