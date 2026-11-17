/**
 * A day, as the server wants it: `YYYY-MM-DD`, no time and no zone. The picker
 * speaks in local `Date`s, so the day is read from and written to its local
 * fields — never through `toISOString`, which would move it across midnight.
 */
export function toDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDayKey(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}
