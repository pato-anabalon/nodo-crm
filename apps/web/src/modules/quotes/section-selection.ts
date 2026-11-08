import { round2, sectionNetAmount, type DiscountType } from "./totals";

/**
 * How a section behaves for the customer. A literal copy of the Prisma
 * enum `QuoteSectionKind`, same reason the rest of this module's types mirror
 * `totals.ts`'s: free of Prisma, so it stays testable without a database.
 */
export type SectionKind = "INDEPENDENT" | "OPTIONAL" | "MULTIPLE_CHOICE";

export type SelectableSection = {
  id: string;
  amount: number;
  discountType: DiscountType;
  discountValue: number;
  kind: SectionKind;
  selectedByDefault: boolean;
};

/**
 * One entry per section: `true`/`false` once the customer has actually
 * decided, `null` or simply absent beforehand — in which case it falls back
 * to that section's own `selectedByDefault`.
 */
export type SectionSelectionState = Record<string, boolean | null | undefined>;

/** The single-threshold volume discount for `OPTIONAL` sections (and a
 * selected `MULTIPLE_CHOICE` one, which counts the same way), or `null` when
 * the quote has none configured. */
export type BundleDiscount = { threshold: number; type: DiscountType; value: number };

export type SectionResolution = {
  /** Every section that counts, in input order — a multiple-choice loser is
   * simply absent, not included at zero. For display (e.g. showing what's
   * currently priced in), not fed to `calculateQuoteTotals` directly. */
  included: Array<{ id: string; netAmount: number }>;
  /** `OPTIONAL`-kind sections resolved as included — excludes the
   * multiple-choice winner and every `INDEPENDENT` section. */
  optionalSelectedCount: number;
  /** What actually counts toward the bundle threshold: every selected
   * `OPTIONAL` section, plus one more if a `MULTIPLE_CHOICE` section has a
   * winner — picking any one of several still reads as "a section selected",
   * since only one of them could ever be chosen in the first place. */
  bundleEligibleCount: number;
  /** 0 when no bundle is configured, or the threshold isn't met. */
  bundleDiscountApplied: number;
  /** Every included section's net amount, summed, minus the bundle discount
   * — ready to hand to `calculateQuoteTotals({ sections: [sectionsTotal], ... })`
   * as the one figure sections contribute to the quote. */
  sectionsTotal: number;
};

/**
 * Resolves which sections count toward the total, and by how much.
 *
 * The one place this runs: the creator's live preview, the server on save,
 * the portal's own live recalculation as the customer ticks boxes, and the
 * freeze at acceptance all call this same function with a different
 * `selection` — never a second implementation of what "counts" means.
 *
 * For a quote where every section is `INDEPENDENT` (every section that
 * existed before this feature), this degenerates to exactly
 * `sum(sectionNetAmount(section))` — the same number `totalsFor` already
 * produced, byte for byte.
 */
export function resolveSelectedSectionAmounts(
  sections: SelectableSection[],
  selection: SectionSelectionState,
  bundle?: BundleDiscount | null,
): SectionResolution {
  const included: Array<{ id: string; netAmount: number }> = [];
  let optionalSelectedCount = 0;

  for (const section of sections) {
    if (section.kind === "INDEPENDENT") {
      included.push({ id: section.id, netAmount: sectionNetAmount(section) });
    } else if (section.kind === "OPTIONAL") {
      const chosen = selection[section.id] ?? section.selectedByDefault;
      if (chosen) {
        included.push({ id: section.id, netAmount: sectionNetAmount(section) });
        optionalSelectedCount++;
      }
    }
    // MULTIPLE_CHOICE sections are resolved together, below — never one at a
    // time in this loop, since the winner has to be picked across all of them.
  }

  // At most one multiple-choice section ever counts, across the whole quote:
  // 1. An explicit customer `true` wins over `selectedByDefault`.
  // 2. More than one explicit `true` (a bug, a race) — the first by array
  //    order wins, the rest are ignored; never double-counted.
  // 3. No explicit `true` at all — the first `selectedByDefault` wins (covers
  //    a creator mistakenly marking two sections as the default).
  const multipleChoice = sections.filter((s) => s.kind === "MULTIPLE_CHOICE");
  const explicit = multipleChoice.find((s) => selection[s.id] === true);
  const winner = explicit ?? multipleChoice.find((s) => s.selectedByDefault);
  if (winner) included.push({ id: winner.id, netAmount: sectionNetAmount(winner) });

  const bundleEligibleCount = optionalSelectedCount + (winner ? 1 : 0);

  const grossIncluded = round2(included.reduce((sum, s) => sum + s.netAmount, 0));

  // The bundle discount's base is the sum of the currently-selected OPTIONAL
  // sections, plus the multiple-choice winner if there is one — never the
  // independent sections. It's a reward for bundling several add-ons
  // together, and a multiple-choice pick counts as one of them the same way
  // it counts toward the threshold above: only one of several could ever be
  // chosen, so choosing one is "selecting an add-on" just as much as ticking
  // an optional one is.
  const bundleBaseIds = new Set(
    sections.filter((s) => s.kind === "OPTIONAL").map((s) => s.id),
  );
  if (winner) bundleBaseIds.add(winner.id);
  const bundleBase = round2(
    included.filter((s) => bundleBaseIds.has(s.id)).reduce((sum, s) => sum + s.netAmount, 0),
  );

  let bundleDiscountApplied = 0;
  if (bundle && bundle.threshold > 0 && bundleEligibleCount >= bundle.threshold) {
    bundleDiscountApplied =
      bundle.type === "PERCENT"
        ? round2(bundleBase * (Math.min(100, Math.max(0, bundle.value)) / 100))
        : round2(Math.min(Math.max(0, bundle.value), bundleBase));
  }

  return {
    included,
    optionalSelectedCount,
    bundleEligibleCount,
    bundleDiscountApplied,
    sectionsTotal: round2(grossIncluded - bundleDiscountApplied),
  };
}
