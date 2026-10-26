import { CheckCircle2 } from "lucide-react";

/**
 * Beside an accepted quote whose job has been finished. The quote's status stays
 * what the customer decided; this says what became of the work.
 */
export function JobCompletedMark({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap text-[var(--status-accepted-text)]">
      <CheckCircle2 className="size-3.5" />
      {label}
    </span>
  );
}

/** Only for people who can open jobs, and only once the quote was accepted and its job finished. */
export function isJobCompleted(
  quote: { status: string; job?: { status: string } | null },
  canSeeJobs: boolean,
) {
  return canSeeJobs && quote.status === "ACCEPTED" && quote.job?.status === "COMPLETED";
}
