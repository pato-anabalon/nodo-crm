/**
 * Quote total calculation.
 *
 * Works in whole cents to dodge the floating-point drift that shows up when
 * summing discounted lines (0.1 + 0.2 !== 0.3). Pure logic, no Prisma, so it can
 * be tested directly.
 */

export type QuoteLineInput = {
  quantity: number;
  unitPrice: number;
  /** Line discount, as a percentage (0-100). */
  discount?: number;
};

/**
 * Percentage of the gross, or a flat amount on the same basis as the prices.
 * Shared by the overall discount and by each section's own — a literal copy
 * of the Prisma enum, same reason `TaxDisplayMode` below is one: this file
 * stays free of Prisma so it can be tested without a database.
 */
export type DiscountType = "PERCENT" | "FIXED";

/**
 * How tax relates to what was typed in and to the total that comes out.
 *
 * A local, string-identical copy of the Prisma enum: this file stays free of
 * Prisma so it can be tested without a database, and a literal string union
 * accepts the generated enum's values without either side importing the other.
 */
export type TaxDisplayMode =
  | "TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
  | "TAX_EXCLUSIVE"
  | "TAX_INCLUSIVE"
  | "NO_TAX";

/** Whether the total this produces has tax folded into it. */
export function taxIsInTotal(mode: TaxDisplayMode): boolean {
  return mode === "TAX_INCLUSIVE" || mode === "TAX_EXCLUSIVE_INCLUSIVE_TOTAL";
}

export type QuoteTotalsInput = {
  /** Itemised lines. Ignored when sections are supplied. */
  items?: QuoteLineInput[];
  /**
   * Section amounts. When present they win over the lines: a single price is
   * simply a quote with one section.
   */
  sections?: number[] | null;
  /** GST, VAT or another tax, as a percentage. Ignored under `NO_TAX`. */
  taxRate?: number;
  /** Overall discount, raw: a percentage if `discountType` is `PERCENT`, a
   * flat amount on the same basis as the prices if `FIXED`. */
  discount?: number;
  /** Defaults to `"FIXED"` — every quote already in the database is one, and
   * this is what keeps their totals computing exactly as they always have. */
  discountType?: DiscountType;
  /**
   * One of four modes, defaulting to the one that used to be `false`:
   * prices exclude tax, and it's added on top into the total shown.
   *
   * `TAX_INCLUSIVE` flips the direction of the sum — tax has to be pulled back
   * out of what was typed rather than added on top. `TAX_EXCLUSIVE` and
   * `NO_TAX` leave tax out of the total entirely: quoted for later, or not
   * charged at all.
   */
  taxDisplayMode?: TaxDisplayMode;
};

export type QuoteTotals = {
  lineTotals: number[];
  /** Net of what was quoted, before discount and excluding tax. */
  subtotal: number;
  discount: number;
  taxableBase: number;
  taxAmount: number;
  total: number;
};

/** Rounds to 2 decimals, half-up — which is what a customer expects. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const scaled = value * 100;
  // The epsilon fixes cases like 1.005 * 100 = 100.49999999999999.
  const rounded = Math.round(scaled + (scaled >= 0 ? Number.EPSILON * scaled : -Number.EPSILON * scaled));
  return rounded / 100;
}

export function lineTotal(line: QuoteLineInput): number {
  const quantity = Math.max(0, line.quantity || 0);
  const unitPrice = Math.max(0, line.unitPrice || 0);
  const discount = clampPercent(line.discount ?? 0);
  const gross = quantity * unitPrice;
  return round2(gross * (1 - discount / 100));
}

export type SectionDiscountInput = {
  amount: number;
  discountType?: DiscountType;
  discountValue?: number;
};

/**
 * One section's price after its own discount.
 *
 * The building block every section-aware total runs through — the form's
 * live preview, the server save, the portal's live recalculation and the
 * acceptance-time freeze all call this the same way, so a section's "final
 * price" can never mean something different in one of them than in another.
 */
export function sectionNetAmount(input: SectionDiscountInput): number {
  const amount = Math.max(0, input.amount || 0);
  const value = Math.max(0, input.discountValue || 0);
  const discount =
    input.discountType === "PERCENT"
      ? round2(amount * (clampPercent(value) / 100))
      : round2(Math.min(value, amount));
  return round2(amount - discount);
}

/**
 * The pricing mode only decides where the sum comes from; discount, tax and
 * total all run the same path.
 *
 * When prices already include tax, the total is exact and what gets derived is
 * the net. That's why tax comes out by subtraction — `total - subtotal` rather
 * than `base × rate`: the breakdown then always reconciles with the total,
 * without rounding leaving a stray cent behind.
 *
 * `TAX_EXCLUSIVE` and `NO_TAX` compute the same tax-exclusive breakdown as
 * `TAX_EXCLUSIVE_INCLUSIVE_TOTAL`, but the total stops at the taxable base:
 * tax is quoted for later (or doesn't apply at all) rather than folded into
 * the figure the customer is shown.
 */
export function calculateQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const mode = input.taxDisplayMode ?? "TAX_EXCLUSIVE_INCLUSIVE_TOTAL";
  const hasSections = Array.isArray(input.sections);

  const lineTotals = hasSections ? [] : (input.items ?? []).map(lineTotal);
  const gross = hasSections
    ? round2((input.sections ?? []).reduce((acc, value) => acc + Math.max(0, value || 0), 0))
    : round2(lineTotals.reduce((acc, value) => acc + value, 0));

  // No tax to speak of, whatever rate happens to be sitting in the field.
  const taxRate = mode === "NO_TAX" ? 0 : clampPercent(input.taxRate ?? 0);
  const factor = 1 + taxRate / 100;

  // A discount larger than what was quoted would leave a negative total.
  // `PERCENT` is of the gross itself; `FIXED` (the default, and every row
  // already in the database) is unchanged from before this branch existed.
  const discountType = input.discountType ?? "FIXED";
  const discountInput =
    discountType === "PERCENT"
      ? round2(gross * (clampPercent(input.discount ?? 0) / 100))
      : round2(Math.min(Math.max(0, input.discount ?? 0), gross));

  if (mode === "TAX_INCLUSIVE") {
    const total = round2(gross - discountInput);
    const subtotal = round2(gross / factor);
    const discount = round2(discountInput / factor);
    const taxableBase = round2(total / factor);

    return { lineTotals, subtotal, discount, taxableBase, taxAmount: round2(total - taxableBase), total };
  }

  const taxableBase = round2(gross - discountInput);
  const taxAmount = round2(taxableBase * (taxRate / 100));
  const total = taxIsInTotal(mode) ? round2(taxableBase + taxAmount) : taxableBase;

  return { lineTotals, subtotal: gross, discount: discountInput, taxableBase, taxAmount, total };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
