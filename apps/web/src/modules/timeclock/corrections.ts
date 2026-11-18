import { addDays } from "@nodo/core/jobs/schedule/calendar";
import { wallClock, zonedInstant } from "@nodo/core/zoned-time";

/**
 * What a supervisor's hand may do to somebody's hours, worked out without a
 * database. A correction is held to what a punch from the phone is held to —
 * nothing in the future, no two shifts at once — plus a ceiling on length,
 * because a shift of thirty hours is a typo in the day, not a day's work.
 */

/** Longer than this is a day typed wrong, not a shift. */
export const MAX_SHIFT_HOURS = 24;

export type Window = { clockInAt: Date; clockOutAt: Date | null };

/**
 * From what the form holds — a day and wall-clock times on the company's
 * calendar — to instants. An end at or before the start is the next morning,
 * a night shift; no end is a shift still open.
 */
export function shiftWindow(day: string, start: string, end: string | null, timeZone: string): Window {
  const clockInAt = zonedInstant(day, start, timeZone);
  if (!end) return { clockInAt, clockOutAt: null };
  return { clockInAt, clockOutAt: zonedInstant(end > start ? day : addDays(day, 1), end, timeZone) };
}

/** The other way, to fill the form: the day it started and its times. */
export function windowFields(window: Window, timeZone: string): { day: string; start: string; end: string } {
  const start = wallClock(window.clockInAt, timeZone);
  return { day: start.day, start: start.time, end: window.clockOutAt ? wallClock(window.clockOutAt, timeZone).time : "" };
}

export type CorrectionProblem = "in_future" | "too_long" | "overlaps";

/**
 * Why a shift can't be recorded as it stands, or null. `others` are the
 * person's other shifts; an open one runs until now, which is what stops a
 * shift being entered over the one somebody is clocked into.
 */
export function correctionProblem(window: Window, others: readonly Window[], now: Date): CorrectionProblem | null {
  if (window.clockInAt > now || (window.clockOutAt && window.clockOutAt > now)) return "in_future";
  if (window.clockOutAt && window.clockOutAt.getTime() - window.clockInAt.getTime() > MAX_SHIFT_HOURS * 3_600_000) return "too_long";
  const end = (shift: Window) => shift.clockOutAt ?? now;
  if (others.some((other) => window.clockInAt < end(other) && other.clockInAt < end(window))) return "overlaps";
  return null;
}

export type ShiftSnapshot = { jobName: string; clockInAt: string; clockOutAt: string | null };

/** What a shift was or became, as the change log keeps it. */
export function snapshot(shift: { jobName: string } & Window): ShiftSnapshot {
  return { jobName: shift.jobName, clockInAt: shift.clockInAt.toISOString(), clockOutAt: shift.clockOutAt?.toISOString() ?? null };
}
