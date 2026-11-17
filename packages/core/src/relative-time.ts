/**
 * How long ago something happened, in the unit that needs no arithmetic.
 *
 * Relative while it still helps, absolute the moment it stops. "3 days ago" is
 * understood without thinking; "4 weeks ago" makes the reader count backwards
 * from today, and at that distance the real date says more than the gap does.
 *
 * Returned as a **descriptor**, not a string: the words belong to whoever is
 * reading and the date format belongs to the company, and neither is known
 * here. A pure function that returned text would have to be handed a translator
 * and a locale, and would stop being checkable without them.
 */
export type Elapsed =
  | { unit: "now" }
  | { unit: "minutes"; value: number }
  | { unit: "hours"; value: number }
  | { unit: "days"; value: number }
  | { unit: "date" };

/** Past this, the gap stops being useful and the date takes over. */
export const ABSOLUTE_AFTER_DAYS = 7;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function elapsed(from: Date, now: Date = new Date()): Elapsed {
  const ms = now.getTime() - from.getTime();

  // A clock that is a little ahead — the customer's, a server's — should read
  // as "just now" rather than as a negative gap or a date in the future.
  if (ms < MINUTE) return { unit: "now" };
  if (ms < HOUR) return { unit: "minutes", value: Math.floor(ms / MINUTE) };
  if (ms < DAY) return { unit: "hours", value: Math.floor(ms / HOUR) };

  const days = Math.floor(ms / DAY);
  return days < ABSOLUTE_AFTER_DAYS ? { unit: "days", value: days } : { unit: "date" };
}
