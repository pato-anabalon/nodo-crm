/**
 * Quotient exports every date as a naive "YYYY-MM-DD HH:MM:SS" string with no
 * timezone marker — it is the wall-clock time in whatever timezone the
 * account itself is set to (Pacific/Auckland for Plaster Pro). To turn that
 * into the correct UTC instant we guess, see what that guess reads as in the
 * target timezone, and correct by the difference — the same trick
 * `date-fns-tz`'s `zonedTimeToUtc` uses, without adding the dependency for
 * three lines of date math.
 */
export function parseQuotientDate(raw: string | null | undefined, timeZone = "Pacific/Auckland"): Date | null {
  if (!raw || !raw.trim()) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;

  const [, y, m, d, hh, mm, ss] = match.map(Number) as unknown as number[];
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const readAs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));

  // `guess` interpreted as UTC reads as `readAs` in the target timezone; the
  // real UTC instant is as far before `guess` as `readAs` is after it.
  const offsetMs = readAs - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

/** Earliest of several possibly-null dates, or null if none parsed. */
export function earliestOf(...dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => d !== null);
  if (valid.length === 0) return null;
  return new Date(Math.min(...valid.map((d) => d.getTime())));
}
