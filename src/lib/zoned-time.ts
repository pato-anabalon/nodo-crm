/**
 * Wall-clock time in a named timezone, without a library.
 *
 * A company in Auckland types "Tuesday 7:30" and means 7:30 on its own clocks,
 * whatever the server's zone and whether or not daylight saving moves between
 * now and then. `Intl` knows every zone's rules; these two functions ask it
 * rather than computing offsets by hand.
 */

function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant at which the clocks in `timeZone` read `day` (`YYYY-MM-DD`) at
 * `time` (`HH:MM`). A time that doesn't exist — skipped by a spring-forward —
 * lands just after the gap, as a wall clock would.
 */
export function zonedInstant(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Twice: the offset at the guess can differ from the offset at the answer
  // when a daylight-saving change falls between them.
  const first = wall - offsetAt(wall, timeZone);
  const second = wall - offsetAt(first, timeZone);
  return new Date(second);
}

/** What the clocks in `timeZone` read at this instant: `{ day: YYYY-MM-DD, time: HH:MM }`. */
export function wallClock(instant: Date, timeZone: string): { day: string; time: string } {
  const shifted = new Date(instant.getTime() + offsetAt(instant.getTime(), timeZone));
  const iso = shifted.toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}
