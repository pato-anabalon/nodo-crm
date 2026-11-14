import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Previous, this and next week, as links: the week is in the address, so a
 * timesheet can be sent to somebody and opens on the same week.
 */
export function WeekNav({
  label,
  previousHref,
  nextHref,
  currentHref,
  labels,
}: {
  label: string;
  previousHref: string;
  nextHref: string;
  /** Null when this already is the current week. */
  currentHref: string | null;
  labels: { previous: string; next: string; current: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon">
        <Link href={previousHref} aria-label={labels.previous}>
          <ChevronLeft className="size-4" />
        </Link>
      </Button>
      <p className="min-w-40 text-center text-sm font-medium tabular-nums">{label}</p>
      <Button asChild variant="outline" size="icon">
        <Link href={nextHref} aria-label={labels.next}>
          <ChevronRight className="size-4" />
        </Link>
      </Button>
      {currentHref ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={currentHref}>{labels.current}</Link>
        </Button>
      ) : null}
    </div>
  );
}
