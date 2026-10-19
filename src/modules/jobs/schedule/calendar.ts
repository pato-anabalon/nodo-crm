/**
 * The arithmetic of days and the geometry of the calendars: which weeks a
 * view shows, which row of a week each event sits on, where a job's bar
 * starts and ends on the Lineup.
 *
 * Days are `YYYY-MM-DD` strings throughout — the company's days, already
 * resolved — so none of this ever meets a timezone. Pure, so it can be
 * checked without a database or a screen.
 */

const DAY_MS = 86_400_000;

function toMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toMs(value)) && fromMs(toMs(value)) === value;
}

export function addDays(day: string, days: number): string {
  return fromMs(toMs(day) + days * DAY_MS);
}

/** Whole days from `earlier` to `later` (negative if `later` is earlier). */
export function daysBetween(earlier: string, later: string): number {
  return Math.round((toMs(later) - toMs(earlier)) / DAY_MS);
}

/** The Monday of the week a day falls in — weeks here start on Monday, as they do in New Zealand. */
export function weekStart(day: string): string {
  const weekday = new Date(toMs(day)).getUTCDay(); // 0 Sunday … 6 Saturday
  return addDays(day, -((weekday + 6) % 7));
}

/** `weeks` rows of seven days, starting on the Monday of `from`'s week. */
export function calendarWeeks(from: string, weeks: number): string[][] {
  const start = weekStart(from);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

export type Span = { id: string; startsOn: string; endsOn: string };

export type WeekSegment<T extends Span> = {
  item: T;
  /** 1-based column the segment starts in, and how many it covers. */
  column: number;
  span: number;
  /** Which row of the week it sits on; 0 is the top. */
  lane: number;
  /** It started before this week, or goes on after it — drawn without a rounded end. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/**
 * Lays out what falls in one week, so that something running several days is
 * one bar across them rather than a copy in each cell. Longer things go first
 * and take the top rows, the way a wall planner is drawn; each then takes the
 * first row with room for it.
 */
export function layoutWeek<T extends Span>(week: string[], items: T[]): WeekSegment<T>[] {
  const first = week[0];
  const last = week[week.length - 1];
  const inWeek = items
    .filter((item) => item.startsOn <= last && item.endsOn >= first)
    .sort(
      (a, b) =>
        a.startsOn.localeCompare(b.startsOn) ||
        daysBetween(b.startsOn, b.endsOn) - daysBetween(a.startsOn, a.endsOn) ||
        a.id.localeCompare(b.id),
    );

  const lanes: number[][] = []; // per lane, the columns already taken
  return inWeek.map((item) => {
    const from = item.startsOn < first ? first : item.startsOn;
    const to = item.endsOn > last ? last : item.endsOn;
    const column = daysBetween(first, from) + 1;
    const span = daysBetween(from, to) + 1;
    const columns = Array.from({ length: span }, (_, i) => column + i);
    let lane = lanes.findIndex((taken) => columns.every((c) => !taken.includes(c)));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push(...columns);
    return {
      item,
      column,
      span,
      lane,
      continuesBefore: item.startsOn < first,
      continuesAfter: item.endsOn > last,
    };
  });
}

/**
 * Where a bar sits in a window of days, in days from the window's start — or
 * null when it falls outside. A job with only one of its two dates is drawn
 * as that one day: it is somewhere on the plan, just not yet a stretch of it.
 */
export function barInWindow(
  startsOn: string | null,
  endsOn: string | null,
  windowStart: string,
  windowDays: number,
): { offset: number; length: number; clippedStart: boolean; clippedEnd: boolean } | null {
  const start = startsOn ?? endsOn;
  const end = endsOn ?? startsOn;
  if (!start || !end) return null;
  const windowEnd = addDays(windowStart, windowDays - 1);
  if (end < windowStart || start > windowEnd) return null;
  const from = start < windowStart ? windowStart : start;
  const to = end > windowEnd ? windowEnd : end;
  return {
    offset: daysBetween(windowStart, from),
    length: daysBetween(from, to) + 1,
    clippedStart: start < windowStart,
    clippedEnd: end > windowEnd,
  };
}

/**
 * The days a window's month headings start on: the window's own first day,
 * then every first of the month inside it. The window's first day is dropped
 * when the next month begins within `minDays` of it — two headings that close
 * would be drawn over each other, and the coming month is the one that matters.
 */
export function monthStarts(windowStart: string, windowDays: number, minDays: number): string[] {
  const firsts = Array.from({ length: windowDays }, (_, i) => addDays(windowStart, i)).filter(
    (day) => day.endsWith("-01") && day !== windowStart,
  );
  const crowded = firsts.length > 0 && daysBetween(windowStart, firsts[0]) < minDays;
  return crowded ? firsts : [windowStart, ...firsts];
}

/**
 * A job's dates after dragging its bar `delta` days: the whole bar, or one of
 * its ends. An end can't be dragged past the other — the shortest a job can
 * be is one day.
 */
export function shiftDates(
  dates: { startsOn: string; endsOn: string },
  part: "move" | "start" | "end",
  delta: number,
): { startsOn: string; endsOn: string } {
  if (part === "move") return { startsOn: addDays(dates.startsOn, delta), endsOn: addDays(dates.endsOn, delta) };
  if (part === "start") {
    const startsOn = addDays(dates.startsOn, delta);
    return { startsOn: startsOn > dates.endsOn ? dates.endsOn : startsOn, endsOn: dates.endsOn };
  }
  const endsOn = addDays(dates.endsOn, delta);
  return { startsOn: dates.startsOn, endsOn: endsOn < dates.startsOn ? dates.startsOn : endsOn };
}
