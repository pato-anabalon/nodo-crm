"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useStoredChoice } from "@/lib/use-stored-choice";

export type CardVariant = "balanced" | "compact";

const VARIANTS: readonly CardVariant[] = ["balanced", "compact"];

/** What somebody sees before they have chosen: the denser one. */
export const DEFAULT_CARD_VARIANT: CardVariant = "compact";

/**
 * The choice of density for a list of cards, remembered per browser.
 *
 * A preference about presentation and nothing else. The caller scopes the key to
 * the screen and the user (`quotes.cardVariant:<userId>`), so two people on one
 * machine keep their own and one screen's choice doesn't decide another's.
 */
export function useCardVariant(storageKey: string) {
  return useStoredChoice(storageKey, VARIANTS, DEFAULT_CARD_VARIANT);
}

export function CardVariantSwitch({
  value,
  onValueChange,
}: {
  value: CardVariant;
  onValueChange: (value: CardVariant) => void;
}) {
  const t = useTranslations("common.cardLayout");
  return (
    <SegmentedControl
      label={t("label")}
      value={value}
      onValueChange={onValueChange}
      options={[
        { value: "balanced", label: t("balanced") },
        { value: "compact", label: t("compact") },
      ]}
    />
  );
}

/**
 * The surface every record card shares: neutral, bordered, answering the
 * pointer, with a ring when its link takes keyboard focus.
 *
 * `group/card` + `data-variant` is how a child can change with the density
 * without being told (`group-data-[variant=compact]/card:…`).
 */
export function RecordCard({
  variant,
  children,
}: {
  variant: CardVariant;
  children: ReactNode;
}) {
  return (
    <article
      data-variant={variant}
      className={cn(
        "group/card relative rounded-2xl border bg-card transition-colors",
        "hover:border-foreground/25 hover:bg-muted/30 active:bg-muted/60",
        "has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/60",
        variant === "balanced" ? "p-5" : "p-4",
      )}
    >
      {children}
    </article>
  );
}

/**
 * The card's one link, stretched over the whole card (`after:absolute
 * after:inset-0`). A real anchor rather than a click handler, so open-in-a-new-tab
 * works and the keyboard has a single stop. Anything else pressable in the card
 * sits above it with `relative z-10`, as its own control.
 */
export function RecordCardLink({
  href,
  title,
  children,
}: {
  href: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      title={title}
      className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']"
    >
      {children}
    </Link>
  );
}

/** The total / value strip at the foot: a tinted panel in balanced, a rule in compact. */
export function RecordCardFooter({
  variant,
  label,
  children,
}: {
  variant: CardVariant;
  label: string;
  children: ReactNode;
}) {
  const balanced = variant === "balanced";
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        balanced
          ? "mt-5 rounded-xl bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))] px-4 py-3"
          : "mt-3 border-t pt-3",
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", balanced ? "text-lg" : "text-base")}>
        {children}
      </span>
    </div>
  );
}
