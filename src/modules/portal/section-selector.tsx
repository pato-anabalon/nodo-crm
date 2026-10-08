"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RichText } from "@/components/rich-text";
import { formatMoney } from "@/lib/format";
import {
  calculateQuoteTotals,
  round2,
  sectionNetAmount,
  taxIsInTotal,
  type DiscountType,
  type TaxDisplayMode,
} from "@/modules/quotes/totals";
import {
  resolveSelectedSectionAmounts,
  type BundleDiscount,
  type SectionKind,
  type SectionSelectionState,
} from "@/modules/quotes/section-selection";
import { usePortalAnimatedTotal } from "./animated-total";
import type { SectionSelectionResult } from "./actions";
import { SectionAttachments, type SectionAttachmentRow } from "./section-attachments";

export type SelectorSection = {
  id: string;
  title: string;
  body: string;
  amount: number;
  discountType: DiscountType;
  discountValue: number;
  kind: SectionKind;
  selectedByDefault: boolean;
  customerSelected: boolean | null;
  attachments: SectionAttachmentRow[];
};

type SectionSelectorProps = {
  sections: SelectorSection[];
  bundle: BundleDiscount | null;
  currency: string;
  formatLocale: string;
  taxRate: number;
  discount: number;
  discountType: DiscountType;
  taxDisplayMode: TaxDisplayMode;
  taxLabel: string;
  open: boolean;
  /**
   * `null` in the team's own preview — interactive and recalculating, same as
   * for the customer, just without persisting anything (see
   * `updateSectionSelectionAction`'s doc for why that write skips
   * `revalidatePath`; a preview that can't write at all needs even less).
   */
  updateSelection:
    | ((sectionId: string, selected: boolean) => Promise<SectionSelectionResult>)
    | null;
};

/**
 * The customer's live view of a quote's selectable sections: the section
 * list, the totals breakdown and the sticky accept bar, all driven by one
 * piece of state.
 *
 * Rendered once, in place of the static section list and `<dl>` — its return
 * is a fragment whose last child is the `position: fixed` accept bar, which
 * does not need to be `<main>`'s literal last DOM node to stay pinned to the
 * viewport. `quote-document.tsx` only mounts this when the quote actually has
 * an `OPTIONAL` or `MULTIPLE_CHOICE` section; every quote that doesn't keeps
 * today's plain server-rendered markup untouched.
 */
export function SectionSelector({
  sections,
  bundle,
  currency,
  formatLocale,
  taxRate,
  discount,
  discountType,
  taxDisplayMode,
  taxLabel,
  open,
  updateSelection,
}: SectionSelectorProps) {
  const t = useTranslations("portal");

  // Seeded once, during render, from each section's own frozen choice — not
  // in an effect, which would mean a synchronous `setState` purely to mirror
  // something already readable now.
  const [selection, setSelection] = useState<SectionSelectionState>(() =>
    Object.fromEntries(sections.map((section) => [section.id, section.customerSelected])),
  );

  function toggleOptional(sectionId: string, selected: boolean) {
    setSelection((current) => ({ ...current, [sectionId]: selected }));
    void updateSelection?.(sectionId, selected);
  }

  function chooseMultiple(sectionId: string) {
    setSelection((current) => {
      const next = { ...current };
      for (const section of sections) {
        if (section.kind === "MULTIPLE_CHOICE") {
          next[section.id] = section.id === sectionId;
        }
      }
      return next;
    });
    void updateSelection?.(sectionId, true);
  }

  const resolved = useMemo(
    () => resolveSelectedSectionAmounts(sections, selection, bundle),
    [sections, selection, bundle],
  );

  const totals = useMemo(
    () =>
      calculateQuoteTotals({
        sections: [resolved.sectionsTotal],
        taxRate,
        discount,
        discountType,
        taxDisplayMode,
      }),
    [resolved.sectionsTotal, taxRate, discount, discountType, taxDisplayMode],
  );

  const animatedTotal = usePortalAnimatedTotal(totals.total);
  const money = (value: number) => formatMoney(value, currency, formatLocale);

  const showTaxBreakdown = taxIsInTotal(taxDisplayMode);
  const totalLabel =
    taxDisplayMode === "NO_TAX"
      ? t("totalPlain", { currency })
      : showTaxBreakdown
        ? t("totalIncluding", { currency, tax: taxLabel })
        : t("totalExcluding", { currency, tax: taxLabel });

  const includedIds = new Set(resolved.included.map((section) => section.id));
  const selectedMultipleChoiceId = sections.find(
    (section) => section.kind === "MULTIPLE_CHOICE" && includedIds.has(section.id),
  )?.id;
  const firstMultipleChoiceId = sections.find((s) => s.kind === "MULTIPLE_CHOICE")?.id;
  const firstOptionalId = sections.find((s) => s.kind === "OPTIONAL")?.id;

  // Recomputed from live state on every render, same as the total itself —
  // not a one-time notice, so dropping back under the threshold brings it
  // straight back rather than leaving it dismissed.
  const bundleBanner = (() => {
    if (!bundle) return null;
    const amount = bundle.type === "PERCENT" ? `${bundle.value}%` : money(bundle.value);
    const remaining = bundle.threshold - resolved.bundleEligibleCount;
    return remaining <= 0
      ? { unlocked: true, text: t("bundleUnlocked", { amount }) }
      : { unlocked: false, text: t("bundleProgress", { count: remaining, amount }) };
  })();

  // `sectionsTotal` already has the bundle discount subtracted out — adding
  // it back is cheaper and safer than re-summing every included section's net
  // amount a second time, and it's exactly how `resolveSelectedSectionAmounts`
  // itself defines `sectionsTotal`, just run in reverse.
  const subtotalDisplay = round2(resolved.sectionsTotal + resolved.bundleDiscountApplied);

  return (
    <>
      <RadioGroup
        value={selectedMultipleChoiceId}
        onValueChange={chooseMultiple}
        className="space-y-8 pt-6"
      >
        {sections.map((section) => {
          const checked = selection[section.id] ?? section.selectedByDefault;
          const net = sectionNetAmount(section);
          const included = includedIds.has(section.id);
          const discountLabel =
            section.discountType === "PERCENT"
              ? t("sectionDiscountOff", { amount: `${section.discountValue}%` })
              : t("sectionDiscountOff", { amount: money(section.discountValue) });
          return (
            <div key={section.id} className="space-y-3">
              {section.id === firstOptionalId && bundleBanner ? (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    bundleBanner.unlocked
                      ? "border-primary/30 bg-primary/10 font-medium text-primary"
                      : "border-dashed border-primary/30 text-muted-foreground",
                  )}
                >
                  {bundleBanner.unlocked ? (
                    <CheckCircle2 className="size-4 shrink-0" />
                  ) : (
                    <Sparkles className="size-4 shrink-0" />
                  )}
                  {bundleBanner.text}
                </div>
              ) : null}
              {section.id === firstMultipleChoiceId ? (
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t("chooseOne")}
                </p>
              ) : null}
              <article className="grid grid-cols-[80%_20%] overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--primary)_60%,transparent)]">
                <div className="min-w-0 space-y-3 p-4">
                  {section.kind === "OPTIONAL" ? (
                    <label className="flex items-start gap-3">
                      <Checkbox
                        className="mt-1"
                        checked={!!checked}
                        onCheckedChange={(value) =>
                          toggleOptional(section.id, value === true)
                        }
                      />
                      <h2 className="text-lg font-semibold">{section.title}</h2>
                    </label>
                  ) : section.kind === "MULTIPLE_CHOICE" ? (
                    <label className="flex items-start gap-3">
                      <RadioGroupItem className="mt-1" value={section.id} />
                      <h2 className="text-lg font-semibold">{section.title}</h2>
                    </label>
                  ) : (
                    <h2 className="text-lg font-semibold">{section.title}</h2>
                  )}
                  <RichText className="text-sm text-muted-foreground" html={section.body} />
                  <SectionAttachments attachments={section.attachments} />
                </div>
                {/* Stretches to the row's full height by default — the
                    title and description beside it decide how tall the row
                    is, and this column fills exactly that, so the whole
                    price side reads as "in" rather than just its figure. No
                    rounding of its own: `overflow-hidden` on the article
                    clips it to the shared outer radius instead. */}
                <div
                  className={cn(
                    "flex items-center justify-end px-3 transition-colors",
                    included && "bg-muted-foreground/10",
                  )}
                >
                  {section.discountValue > 0 ? (
                    <div className="flex flex-col items-end gap-0.5 py-2">
                      <span className="text-xs text-muted-foreground line-through">
                        {money(section.amount)}
                      </span>
                      <span className="text-xs font-semibold text-primary">
                        {discountLabel}
                      </span>
                      <span className="text-lg font-medium tabular-nums">{money(net)}</span>
                    </div>
                  ) : (
                    <span className="text-lg font-medium tabular-nums">{money(net)}</span>
                  )}
                </div>
              </article>
            </div>
          );
        })}
      </RadioGroup>

      <dl className="ml-auto max-w-xs space-y-1.5 pt-4 text-sm">
        <Row label={t("subtotal")} value={money(subtotalDisplay)} />
        {resolved.bundleDiscountApplied > 0 ? (
          <Row label={t("bundleDiscount")} value={`− ${money(resolved.bundleDiscountApplied)}`} />
        ) : null}
        {totals.discount > 0 ? (
          <Row label={t("discount")} value={`− ${money(totals.discount)}`} />
        ) : null}
        {showTaxBreakdown ? (
          <Row label={`${taxLabel} ${taxRate}%`} value={money(totals.taxAmount)} />
        ) : null}
        <div className="flex items-baseline justify-between gap-3 pt-2 text-base font-semibold">
          <dt>{totalLabel}</dt>
          <dd className="tabular-nums">{money(animatedTotal)}</dd>
        </div>
      </dl>

      {open ? (
        <div className="no-print fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <span className="text-sm">
              <span className="text-muted-foreground">{totalLabel}</span>{" "}
              <span className="text-base font-semibold tabular-nums">
                {money(animatedTotal)}
              </span>
            </span>
            {totals.total > 0 ? (
              <Button asChild>
                <a href="#accept">{t("accept")}</a>
              </Button>
            ) : (
              // Nothing's selected, so there's nothing to accept yet — the
              // real, server-side stop is in `acceptQuoteAction` itself; this
              // is just not sending the customer toward a submit that would
              // bounce back with an error once they got there.
              <Button disabled title={t("errors.nothingSelected")}>
                {t("accept")}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
