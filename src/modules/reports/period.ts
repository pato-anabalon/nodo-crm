/**
 * The dashboard period selector.
 *
 * Deliberately a pure function: this is where the edge cases hide — the year
 * rollover, 31-day months, the last day of a quarter — and every one of them can
 * be tested without a database.
 *
 * Ranges are half-open `[from, to)`: the upper bound is never included, which is
 * what stops a record from being lost or counted twice right at midnight.
 */

export type PeriodKind = "month" | "quarter" | "half" | "year" | "days";

export type PeriodSpec = {
  kind: PeriodKind;
  /** Reference year. Ignored when `kind` is "days". */
  year?: number;
  /** Month 1-12, quarter 1-4 or half 1-2, depending on `kind`. */
  index?: number;
  /** How many days back when `kind` is "days". */
  days?: number;
};

export type Period = {
  from: Date;
  to: Date;
  kind: PeriodKind;
  label: string;
};

export const QUARTER_MONTHS = 3;
export const HALF_MONTHS = 6;

/** The "last N days" options the panel offers. */
export const DAY_PRESETS = [7, 30, 90, 180, 365] as const;

export function resolvePeriod(spec: PeriodSpec, now: Date = new Date()): Period {
  const year = spec.year ?? now.getFullYear();

  switch (spec.kind) {
    case "month": {
      const month = clamp(spec.index ?? now.getMonth() + 1, 1, 12);
      return {
        from: utc(year, month - 1, 1),
        // Month 12 overflows to 12 and `Date.UTC` resolves it as next January.
        to: utc(year, month, 1),
        kind: "month",
        label: `${year}-${String(month).padStart(2, "0")}`,
      };
    }

    case "quarter": {
      const quarter = clamp(spec.index ?? currentQuarter(now), 1, 4);
      const startMonth = (quarter - 1) * QUARTER_MONTHS;
      return {
        from: utc(year, startMonth, 1),
        to: utc(year, startMonth + QUARTER_MONTHS, 1),
        kind: "quarter",
        label: `Q${quarter} ${year}`,
      };
    }

    case "half": {
      const half = clamp(spec.index ?? (now.getMonth() < 6 ? 1 : 2), 1, 2);
      const startMonth = (half - 1) * HALF_MONTHS;
      return {
        from: utc(year, startMonth, 1),
        to: utc(year, startMonth + HALF_MONTHS, 1),
        kind: "half",
        label: `S${half} ${year}`,
      };
    }

    case "days": {
      const days = clamp(spec.days ?? 30, 1, 3650);
      // From the start of the day N-1 days ago to the end of today: "last 7
      // days" has to include today, not stop at last midnight.
      const end = startOfUtcDay(now);
      end.setUTCDate(end.getUTCDate() + 1);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - days);
      return { from: start, to: end, kind: "days", label: `${days}d` };
    }

    case "year":
    default:
      return {
        from: utc(year, 0, 1),
        to: utc(year + 1, 0, 1),
        kind: "year",
        label: String(year),
      };
  }
}

/**
 * The comparable period immediately before this one.
 *
 * Always ends exactly where the current one starts, so nothing is counted twice
 * and nothing falls between the two. Calendar periods step back by their own
 * span — the month before March is February, whatever their lengths — while
 * "last N days" steps back by the same N days.
 */
export function previousPeriod(period: Period): Period {
  if (period.kind === "days") {
    const span = period.to.getTime() - period.from.getTime();
    return {
      from: new Date(period.from.getTime() - span),
      to: new Date(period.from.getTime()),
      kind: "days",
      label: period.label,
    };
  }

  const months = { month: 1, quarter: QUARTER_MONTHS, half: HALF_MONTHS, year: 12 }[period.kind];
  // `from` is always the first of a month here, so stepping the month index back
  // is exact: no 31st landing on a month that hasn't got one.
  const from = utc(period.from.getUTCFullYear(), period.from.getUTCMonth() - months, 1);

  return { from, to: new Date(period.from.getTime()), kind: period.kind, label: labelFor(period.kind, from) };
}

function labelFor(kind: PeriodKind, from: Date): string {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();

  if (kind === "month") return `${year}-${String(month + 1).padStart(2, "0")}`;
  if (kind === "quarter") return `Q${Math.floor(month / QUARTER_MONTHS) + 1} ${year}`;
  if (kind === "half") return `S${Math.floor(month / HALF_MONTHS) + 1} ${year}`;
  return String(year);
}

export function currentQuarter(date: Date): number {
  return Math.floor(date.getMonth() / QUARTER_MONTHS) + 1;
}

/** How many days the period spans. */
export function periodDays(period: Period): number {
  return Math.round((period.to.getTime() - period.from.getTime()) / 86_400_000);
}

/** Reads the period from the URL parameters, trusting none of them. */
export function periodFromParams(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): Period {
  const kind = single(params.period);
  const year = toInt(single(params.year)) ?? now.getFullYear();

  if (kind === "days") {
    return resolvePeriod({ kind: "days", days: toInt(single(params.days)) ?? 30 }, now);
  }
  if (kind === "month" || kind === "quarter" || kind === "half") {
    return resolvePeriod({ kind, year, index: toInt(single(params.index)) }, now);
  }
  return resolvePeriod({ kind: "year", year }, now);
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
