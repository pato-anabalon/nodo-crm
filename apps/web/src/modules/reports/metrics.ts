/**
 * The arithmetic the panel reports with.
 *
 * Separated from the queries so the awkward cases — dividing by a period with no
 * activity, a median over an even number of values — are settled once and tested
 * without a database.
 */

/**
 * Change against the previous period, as a percentage.
 *
 * Returns `null` when there is nothing to compare against: growth from zero is
 * not "+100%", it is undefined, and showing a number there invents a fact. The
 * panel writes "no previous data" instead.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/** A step's share of the one before it. 0 when there was nothing to convert. */
export function conversionRate(step: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round((step / previous) * 100);
}

/**
 * The middle value, not the average.
 *
 * One quote that sat unanswered for eight months would drag a mean far away from
 * what the team actually experiences; the median stays where most of the cases
 * are.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? round1((sorted[middle - 1] + sorted[middle]) / 2)
    : round1(sorted[middle]);
}

/** Whole days between two moments, as a decimal so hours still register. */
export function daysBetween(from: Date, to: Date): number {
  return round1((to.getTime() - from.getTime()) / 86_400_000);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export type Measured = { count: number; value: number };

/** What the panel is showing: a total, a headcount, or the typical quote. */
export type DisplayAs = "value" | "count" | "average";

/**
 * The figure for the chosen measure.
 *
 * An average over nothing is reported as zero rather than as NaN: a period with
 * no quotes has no typical quote, and that reads better as an empty figure than
 * as an error leaking onto the panel.
 */
export function measure(bucket: Measured, display: DisplayAs): number {
  if (display === "count") return bucket.count;
  if (display === "average") return bucket.count === 0 ? 0 : bucket.value / bucket.count;
  return bucket.value;
}
