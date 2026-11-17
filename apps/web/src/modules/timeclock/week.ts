import { addDays, isDay, weekStart } from "@nodo/core/jobs/schedule/calendar";

/**
 * The week a timesheet shows, Monday to Sunday on the company's calendar,
 * from `?week=` — any day of it — or the current one. A malformed value is the
 * current week rather than an error: it is a link somebody edited by hand.
 */
export function weekFrom(param: string | string[] | undefined, today: string): { from: string; to: string } {
  const day = typeof param === "string" && isDay(param) ? param : today;
  const from = weekStart(day);
  return { from, to: addDays(from, 6) };
}

/** A day as a column heads it, in the company's format: `Mon 9`. */
export function dayHeading(day: string, formatLocale: string): string {
  return new Intl.DateTimeFormat(formatLocale, { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** A day written out: `Monday 9 November`. */
export function dayTitle(day: string, formatLocale: string): string {
  return new Intl.DateTimeFormat(formatLocale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** The week as a range: `9 – 15 Nov 2026`. */
export function weekRange(from: string, to: string, formatLocale: string): string {
  return new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).formatRange(
    new Date(`${from}T00:00:00Z`),
    new Date(`${to}T00:00:00Z`),
  );
}
