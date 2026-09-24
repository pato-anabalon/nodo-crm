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

export type QuoteTotalsInput = {
  /** Itemised lines. Ignored when sections are supplied. */
  items?: QuoteLineInput[];
  /**
   * Section amounts. When present they win over the lines: a single price is
   * simply a quote with one section.
   */
  sections?: number[] | null;
  /** GST, VAT or another tax, as a percentage. */
  taxRate?: number;
  /** Overall discount, as an amount, on the same basis as the prices. */
  discount?: number;
  /**
   * Whether the amounts entered already carry the tax inside.
   *
   * It flips the direction of the sum: instead of adding tax on top, it has to
   * be pulled back out. The breakdown that comes out is the same either way.
   */
  pricesIncludeTax?: boolean;
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

/**
 * The pricing mode only decides where the sum comes from; discount, tax and
 * total all run the same path.
 *
 * When prices already include tax, the total is exact and what gets derived is
 * the net. That's why tax comes out by subtraction — `total - subtotal` rather
 * than `base × rate`: the breakdown then always reconciles with the total,
 * without rounding leaving a stray cent behind.
 */
export function calculateQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const hasSections = Array.isArray(input.sections);

  const lineTotals = hasSections ? [] : (input.items ?? []).map(lineTotal);
  const gross = hasSections
    ? round2((input.sections ?? []).reduce((acc, value) => acc + Math.max(0, value || 0), 0))
    : round2(lineTotals.reduce((acc, value) => acc + value, 0));

  const taxRate = clampPercent(input.taxRate ?? 0);
  const factor = 1 + taxRate / 100;

  // A discount larger than what was quoted would leave a negative total.
  const discountInput = round2(Math.min(Math.max(0, input.discount ?? 0), gross));

  if (input.pricesIncludeTax) {
    const total = round2(gross - discountInput);
    const subtotal = round2(gross / factor);
    const discount = round2(discountInput / factor);
    const taxableBase = round2(total / factor);

    return { lineTotals, subtotal, discount, taxableBase, taxAmount: round2(total - taxableBase), total };
  }

  const taxableBase = round2(gross - discountInput);
  const taxAmount = round2(taxableBase * (taxRate / 100));

  return {
    lineTotals,
    subtotal: gross,
    discount: discountInput,
    taxableBase,
    taxAmount,
    total: round2(taxableBase + taxAmount),
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
