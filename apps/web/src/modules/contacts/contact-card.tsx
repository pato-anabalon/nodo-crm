"use client";

import { Mail, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import {
  RecordCard,
  RecordCardFooter,
  RecordCardLink,
  type CardVariant,
} from "@/components/ui/record-card";

export type ContactCardData = {
  id: string;
  href: string;
  name: string;
  position: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  leadCount: number;
};

/** Pressable inside the card, above its stretched link, so a tap calls or writes. */
const REACH = "relative z-10 [overflow-wrap:anywhere] underline-offset-2 hover:underline";

/**
 * One contact as a card, in the same two densities as quotes and leads (see
 * `QuoteCard`). What sets it apart is that the email and the phone are links:
 * on a phone the useful thing to do with a contact is reach them, and those two
 * sit above the card's own link as separate controls.
 */
export function ContactCard({
  contact,
  variant,
}: {
  contact: ContactCardData;
  variant: CardVariant;
}) {
  const t = useTranslations("contacts");
  const tCommon = useTranslations("common");
  const balanced = variant === "balanced";

  const email = contact.email ? (
    <a href={`mailto:${contact.email}`} className={REACH}>
      {contact.email}
    </a>
  ) : (
    <span className="text-muted-foreground">{tCommon("none")}</span>
  );
  const phone = contact.phone ? (
    <a href={`tel:${contact.phone}`} className={cn(REACH, "whitespace-nowrap")}>
      {contact.phone}
    </a>
  ) : (
    <span className="text-muted-foreground">{tCommon("none")}</span>
  );

  return (
    <RecordCard variant={variant}>
      <h3 className="leading-snug font-semibold break-words">
        <RecordCardLink href={contact.href} title={contact.name}>
          {contact.name}
        </RecordCardLink>
      </h3>
      {contact.position ? (
        <p className="mt-0.5 text-sm break-words text-muted-foreground">{contact.position}</p>
      ) : null}

      {balanced ? (
        <div className="mt-5 space-y-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">{t("columns.account")}</div>
            <div className="mt-0.5 break-words">{contact.companyName ?? tCommon("none")}</div>
          </div>
          {/* One to a row: an email in half a column wraps mid-word. */}
          <div className="min-w-0 border-t pt-4">
            <div className="text-xs text-muted-foreground">{t("columns.email")}</div>
            <div className="mt-0.5">{email}</div>
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{t("columns.phone")}</div>
            <div className="mt-0.5">{phone}</div>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-1 text-sm">
          {contact.companyName ? (
            <p className="break-words text-muted-foreground">{contact.companyName}</p>
          ) : null}
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
        </div>
      )}

      <RecordCardFooter variant={variant} label={t("columns.leads")}>
        {contact.leadCount}
      </RecordCardFooter>
    </RecordCard>
  );
}
