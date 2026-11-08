"use client";

import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { CalendarDays, MousePointerClick } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import {
  RecordCard,
  RecordCardFooter,
  RecordCardLink,
  type CardVariant,
} from "@/components/ui/record-card";

export type QuoteCardVariant = CardVariant;

/**
 * What a card shows. Plain text where the server already had it, and a slot
 * where the thing is live (`seen`, the open counts), hidden by a permission
 * (`total`) or owns a server action (`menu`) — a client component can be handed
 * rendered nodes but not the functions that would draw them.
 */
export type QuoteCardData = {
  id: string;
  href: string;
  title: string;
  reference: string;
  customerName: string | null;
  companyName: string | null;
  statusLabel: string;
  statusClass: string;
  /** "Job completed" once the job this quote became has been finished, otherwise null. */
  jobCompletedLabel?: string | null;
  /** "3 days ago", or null when it has not gone out. */
  sent: string | null;
  seen: ReactNode;
  opensCount: ReactNode;
  opensLabel: ReactNode;
  total: ReactNode;
  menu: ReactNode;
};

/**
 * One quote as a card, in two densities that are the same card.
 *
 * The variant moves things and changes spacing; it never adds or drops a datum.
 * Both are in one component on purpose — two components that begin identical are
 * how the second one ends up without the fix the first one got.
 *
 * **The whole card opens the quote**, through the title's link stretched over it
 * (`after:absolute after:inset-0`). A link rather than a click handler, so it is
 * a real anchor: middle-click and "open in new tab" work, and the keyboard has a
 * single stop. The menu sits above it (`z-10`) as its own control, so nesting is
 * never invalid and a press on it opens the menu and not the quote.
 *
 * Neutral surfaces only. The company's colour appears as text in the reference
 * (`--brand-ink`, the one chosen to be read) and as a faint wash behind the
 * total; a status keeps its own colour whoever the company is.
 */
export function QuoteCard({
  quote,
  variant,
}: {
  quote: QuoteCardData;
  variant: QuoteCardVariant;
}) {
  const t = useTranslations("quotes");
  const tCommon = useTranslations("common");
  const balanced = variant === "balanced";

  const badge = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        quote.statusClass,
      )}
    >
      {quote.statusLabel}
    </span>
  );

  // The quote stays Accepted — that is what the customer decided — and this says
  // what became of the work. A second mark beside it rather than a different status.
  const completed = quote.jobCompletedLabel ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap text-[var(--status-accepted-text)]">
      <CheckCircle2 className="size-3.5" />
      {quote.jobCompletedLabel}
    </span>
  ) : null;

  const statusMarks = (
    <div className="flex flex-col items-end gap-1">
      {badge}
      {completed}
    </div>
  );

  const customer = (
    <div className="min-w-0">
      {balanced ? (
        <div className="text-xs text-muted-foreground">{t("columns.customer")}</div>
      ) : null}
      {quote.customerName ? (
        <div className={cn("font-medium break-words", balanced && "mt-0.5")}>
          {quote.customerName}
        </div>
      ) : null}
      {quote.companyName ? (
        <div className="text-sm break-words text-muted-foreground">{quote.companyName}</div>
      ) : null}
      {!quote.customerName && !quote.companyName ? (
        <div className="text-sm text-muted-foreground">{tCommon("none")}</div>
      ) : null}
    </div>
  );

  return (
    <RecordCard variant={variant}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="leading-snug font-semibold break-words">
            <RecordCardLink href={quote.href} title={quote.title}>
              {quote.title}
            </RecordCardLink>
          </h3>
          <p className="mt-0.5 font-mono text-xs text-[var(--brand-ink)]">{quote.reference}</p>
        </div>
        {/* 44px to press, pulled into the corner so it costs the layout none. */}
        <div className="relative z-10 -mt-2.5 -mr-2.5 shrink-0">{quote.menu}</div>
      </div>

      <div className={cn("flex items-start justify-between gap-3", balanced ? "mt-5" : "mt-3")}>
        {customer}
        {balanced ? (
          <div className="shrink-0 text-right">
            <div className="mb-1 text-xs text-muted-foreground">{t("columns.status")}</div>
            {statusMarks}
          </div>
        ) : (
          statusMarks
        )}
      </div>

      {balanced ? (
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t("columns.sent")}</dt>
            <dd className="mt-0.5">{quote.sent ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("columns.opens")}</dt>
            <dd className="mt-0.5">{quote.opensCount}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" title={t("columns.sent")}>
            <CalendarDays aria-hidden className="size-3.5" />
            <span className="sr-only">{t("columns.sent")}: </span>
            {quote.sent ?? "—"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MousePointerClick aria-hidden className="size-3.5" />
            {quote.opensLabel}
          </span>
        </p>
      )}

      {/* What the customer did lately, kept apart from the status. Empty is hidden. */}
      <div className={cn("text-xs empty:hidden", balanced ? "mt-3" : "mt-1.5")}>{quote.seen}</div>

      <RecordCardFooter variant={variant} label={t("columns.total")}>
        {quote.total}
      </RecordCardFooter>
    </RecordCard>
  );
}
