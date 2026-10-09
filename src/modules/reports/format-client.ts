import type { DisplayAs } from "./service";

/**
 * Formatting for the chart components.
 *
 * It lives here because client components can't receive functions from the
 * server: they're handed the parameters and build the formatter themselves.
 */
export type ChartFormat = {
  display: DisplayAs;
  currency: string;
  formatLocale: string;
};

const ZERO_DECIMAL = new Set(["CLP", "JPY", "KRW", "VND", "ISK"]);

export function makeValueFormatter({ display, currency, formatLocale }: ChartFormat) {
  if (display === "count") {
    const formatter = new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 0 });
    return (value: number) => formatter.format(Math.round(value));
  }

  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const formatter = new Intl.NumberFormat(formatLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return (value: number) => formatter.format(value);
}

/**
 * The short form for a gridline — "$100K" rather than "$100,000.00" — where
 * `makeValueFormatter`'s full precision is what the tooltip needs, not what
 * several labels stacked down an axis do.
 *
 * `Intl`'s own `notation: "compact"` rather than a hand-rolled "k"/"M" suffix:
 * "k" is an English convention, and the company's own `formatLocale` is what
 * decides every other figure in the app — a Spanish-reading company sees "100
 * mil", which `Intl` already knows how to produce correctly.
 */
export function makeCompactValueFormatter({ display, currency, formatLocale }: ChartFormat) {
  if (display === "count") {
    const formatter = new Intl.NumberFormat(formatLocale, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
    return (value: number) => formatter.format(Math.round(value));
  }

  const formatter = new Intl.NumberFormat(formatLocale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (value: number) => formatter.format(value);
}

/** Short labels for the axis; the series dates already come in UTC. */
export function makeShortDateFormatter(formatLocale: string) {
  const formatter = new Intl.DateTimeFormat(formatLocale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return (iso: string) => formatter.format(new Date(iso));
}

export function makeLongDateFormatter(formatLocale: string) {
  const formatter = new Intl.DateTimeFormat(formatLocale, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  return (iso: string) => formatter.format(new Date(iso));
}
