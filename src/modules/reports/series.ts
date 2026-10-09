import type { Period } from "./period";
import { conversionRate } from "./metrics";

export type SeriesInput = {
  at: Date;
  value: number;
  accepted: boolean;
};

export type SeriesPoint = {
  /** Start of the bucket, in short ISO: serves as both key and label. */
  date: string;
  total: number;
  accepted: number;
};

/**
 * Groups quotes by day.
 *
 * Empty days are included on purpose: without them a quiet stretch vanishes
 * from the chart and the curve lies about the drop.
 */
export function buildSeries(inputs: SeriesInput[], period: Period): SeriesPoint[] {
  const points = new Map<string, SeriesPoint>();

  for (
    let cursor = bucketStart(period.from);
    cursor < period.to;
    cursor = nextBucket(cursor)
  ) {
    const key = toKey(cursor);
    points.set(key, { date: key, total: 0, accepted: 0 });
  }

  for (const input of inputs) {
    const key = toKey(bucketStart(input.at));
    const point = points.get(key);
    // A record outside the requested range must not create a stray bucket.
    if (!point) continue;

    point.total += input.value;
    if (input.accepted) point.accepted += input.value;
  }

  return [...points.values()];
}

/**
 * Rolling window, like Quotient's "rolling period".
 *
 * Smooths the noise of individual days and lets the trend show, which is what a
 * sales panel is actually read for.
 */
export function rollingSum(points: SeriesPoint[], days: number): SeriesPoint[] {
  const window = Math.max(1, Math.round(days));

  return points.map((point, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = points.slice(start, index + 1);
    return {
      date: point.date,
      total: round2(slice.reduce((acc, p) => acc + p.total, 0)),
      accepted: round2(slice.reduce((acc, p) => acc + p.accepted, 0)),
    };
  });
}

/**
 * Two series into one: the average per bucket.
 *
 * The sums are kept apart until this last step on purpose. A rolling window has
 * to be applied to the totals and the counts separately and divided afterwards,
 * because the average of a run of averages is not the average of the run.
 */
export function divideSeries(sums: SeriesPoint[], counts: SeriesPoint[]): SeriesPoint[] {
  return sums.map((point, index) => {
    const n = counts[index];
    return {
      date: point.date,
      total: n && n.total > 0 ? round2(point.total / n.total) : 0,
      accepted: n && n.accepted > 0 ? round2(point.accepted / n.accepted) : 0,
    };
  });
}

export function bucketStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nextBucket(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Accepted share of everything answered, for the panel's donut.
 *
 * The same arithmetic as a funnel step, so it delegates rather than keeping a
 * second copy that could drift on rounding.
 */
export function acceptanceRate(accepted: number, total: number): number {
  return conversionRate(accepted, total);
}
