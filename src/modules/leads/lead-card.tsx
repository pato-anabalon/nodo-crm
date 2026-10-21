"use client";

import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import {
  RecordCard,
  RecordCardFooter,
  RecordCardLink,
  type CardVariant,
} from "@/components/ui/record-card";

/** Rendered nodes where the server owns the drawing (the status badge). */
export type LeadCardData = {
  id: string;
  href: string;
  title: string;
  companyName: string | null;
  owner: string;
  status: ReactNode;
  quoteCount: number;
  /** The formatted estimate, or the "none" dash. */
  value: string;
};

/**
 * One lead as a card, in the same two densities as a quote's. See `QuoteCard`
 * for the rules both follow: the variant moves things and never drops a datum,
 * and the whole card is one stretched link.
 */
export function LeadCard({ lead, variant }: { lead: LeadCardData; variant: CardVariant }) {
  const t = useTranslations("leads");
  const balanced = variant === "balanced";

  return (
    <RecordCard variant={variant}>
      <h3 className="leading-snug font-semibold break-words">
        <RecordCardLink href={lead.href} title={lead.title}>
          {lead.title}
        </RecordCardLink>
      </h3>
      {lead.companyName ? (
        <p className="mt-0.5 text-sm break-words text-muted-foreground">{lead.companyName}</p>
      ) : null}

      <div className={cn("flex items-start justify-between gap-3", balanced ? "mt-5" : "mt-3")}>
        <div className="min-w-0">
          {balanced ? <div className="text-xs text-muted-foreground">{t("columns.owner")}</div> : null}
          <div className={cn("break-words", balanced ? "mt-0.5 font-medium" : "text-sm")}>
            {lead.owner}
          </div>
        </div>
        {balanced ? (
          <div className="shrink-0 text-right">
            <div className="mb-1 text-xs text-muted-foreground">{t("columns.status")}</div>
            {lead.status}
          </div>
        ) : (
          <div className="shrink-0">{lead.status}</div>
        )}
      </div>

      {balanced ? (
        <dl className="mt-5 border-t pt-4 text-sm">
          <dt className="text-xs text-muted-foreground">{t("columns.quotes")}</dt>
          <dd className="mt-0.5 tabular-nums">{lead.quoteCount}</dd>
        </dl>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText aria-hidden className="size-3.5" />
          {t("cards.quotes", { count: lead.quoteCount })}
        </p>
      )}

      <RecordCardFooter variant={variant} label={t("columns.estimatedValue")}>
        {lead.value}
      </RecordCardFooter>
    </RecordCard>
  );
}
