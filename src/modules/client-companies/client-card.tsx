"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { RecordCard, RecordCardLink, type CardVariant } from "@/components/ui/record-card";

export type ClientCardData = {
  id: string;
  href: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  peopleCount: number;
  leadCount: number;
};

/** Pressable inside the card, above its stretched link, so a tap calls or writes. */
const REACH = "relative z-10 [overflow-wrap:anywhere] underline-offset-2 hover:underline";

/**
 * One customer company as a card, in the same two densities as the other lists
 * (see `QuoteCard`). Its address is shown whole: the table truncates it so one
 * long address can't set the height of a row, but a card has the width to wrap
 * and an address cut off on a phone is one nobody can read.
 */
export function ClientCard({ client, variant }: { client: ClientCardData; variant: CardVariant }) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const balanced = variant === "balanced";

  const none = <span className="text-muted-foreground">{tCommon("none")}</span>;
  const email = client.email ? (
    <a href={`mailto:${client.email}`} className={REACH}>
      {client.email}
    </a>
  ) : (
    none
  );
  const phone = client.phone ? (
    <a href={`tel:${client.phone}`} className={cn(REACH, "whitespace-nowrap")}>
      {client.phone}
    </a>
  ) : (
    none
  );
  const address = client.address ? <span className="break-words">{client.address}</span> : none;

  return (
    <RecordCard variant={variant}>
      <h3 className="leading-snug font-semibold break-words">
        <RecordCardLink href={client.href} title={client.name}>
          {client.name}
        </RecordCardLink>
      </h3>
      {client.taxId ? (
        <p className="mt-0.5 font-mono text-xs break-words text-muted-foreground">{client.taxId}</p>
      ) : null}

      {balanced ? (
        <div className="mt-5 space-y-4 text-sm">
          {/* One to a row: an email in half a column wraps mid-word. */}
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{t("columns.email")}</div>
            <div className="mt-0.5">{email}</div>
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{t("columns.phone")}</div>
            <div className="mt-0.5">{phone}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("columns.address")}</div>
            <div className="mt-0.5">{address}</div>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <dt className="text-xs text-muted-foreground">{t("columns.people")}</dt>
              <dd className="mt-0.5 tabular-nums">{client.peopleCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("columns.leads")}</dt>
              <dd className="mt-0.5 tabular-nums">{client.leadCount}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-1 text-sm">
            <p className="flex items-start gap-2">
              <Mail aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="sr-only">{t("columns.email")}: </span>
              <span className="min-w-0">{email}</span>
            </p>
            <p className="flex items-start gap-2">
              <Phone aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="sr-only">{t("columns.phone")}: </span>
              <span className="min-w-0">{phone}</span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="sr-only">{t("columns.address")}: </span>
              <span className="min-w-0">{address}</span>
            </p>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 border-t pt-3 text-xs text-muted-foreground tabular-nums">
            <span>{t("cards.people", { count: client.peopleCount })}</span>
            <span>{t("cards.leads", { count: client.leadCount })}</span>
          </p>
        </>
      )}
    </RecordCard>
  );
}
