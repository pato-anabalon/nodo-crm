import { elapsed } from "./relative-time";
import { formatDate } from "./format";

/**
 * Turns an instant into the phrase somebody reads.
 *
 * Kept apart from `elapsed` so that the arithmetic stays checkable without a
 * translator and without a locale. This half only chooses between the four
 * relative phrasings and the company's own date format.
 */
export function elapsedLabel(
  date: Date,
  t: (key: string, values?: Record<string, number>) => string,
  formatLocale: string,
  timeZone: string,
  now: Date = new Date(),
): string {
  const gap = elapsed(date, now);
  return gap.unit === "date"
    ? formatDate(date, formatLocale, timeZone)
    : t(gap.unit, "value" in gap ? { value: gap.value } : undefined);
}
