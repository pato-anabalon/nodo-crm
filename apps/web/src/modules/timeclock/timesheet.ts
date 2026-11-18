import { addDays } from "@nodo/core/jobs/schedule/calendar";
import { dayPay, shiftMinutes, type BreakPolicy, type DayPay } from "@nodo/core/timeclock/pay";
import { isLatePunch } from "@nodo/core/timeclock/punch";
import { wallClock } from "@nodo/core/zoned-time";

/**
 * Shifts laid out as a timesheet: per person, per day on the company's
 * calendar, with the day's breaks applied. Pure, so the screen and the export
 * add up identically and the rules are checked without a database.
 *
 * A shift belongs to the day it started on — a night that crosses midnight is
 * the evening's. A shift still open counts nothing yet: its hours aren't known,
 * and the timesheet says it is open rather than guessing.
 */

export type ShiftInput = {
  id: string;
  userId: string;
  jobId: string | null;
  jobName: string;
  source: "MOBILE" | "MANUAL";
  clockInAt: Date;
  clockInReceivedAt: Date;
  clockInDistanceM: number | null;
  clockOutAt: Date | null;
  clockOutReceivedAt: Date | null;
  clockOutInside: boolean | null;
  editedAt: Date | null;
  note: string | null;
};

export type Shift = ShiftInput & {
  day: string;
  minutes: number | null;
  /** Arrived more than ten minutes after it was made — the phone had no signal. */
  late: boolean;
  /** Clocked out away from the job. */
  leftAway: boolean;
};

/** A day whose meal break a supervisor set by hand, and why. */
export type MealAdjustment = { userId: string; day: string; mealBreakMinutes: number; reason: string };

export type TimesheetDay = DayPay & { day: string; shifts: Shift[]; open: boolean; mealReason: string | null };

export type PersonTimesheet = {
  userId: string;
  days: TimesheetDay[];
  workedMinutes: number;
  unpaidMinutes: number;
  paidMinutes: number;
  /** Days with at least one closed shift. */
  daysWorked: number;
  /** Something on it a person should look at: a shift open, late or ended away. */
  flagged: boolean;
};

/** Every day from `from` to `to`, inclusive. */
export function daysOf(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function toShift(input: ShiftInput, timeZone: string): Shift {
  return {
    ...input,
    day: wallClock(input.clockInAt, timeZone).day,
    minutes: input.clockOutAt ? shiftMinutes(input.clockInAt, input.clockOutAt) : null,
    late:
      isLatePunch(input.clockInAt, input.clockInReceivedAt) ||
      (input.clockOutAt !== null && input.clockOutReceivedAt !== null && isLatePunch(input.clockOutAt, input.clockOutReceivedAt)),
    leftAway: input.clockOutInside === false,
  };
}

/**
 * One person's days from `from` to `to`. Every day of the window is there,
 * worked or not, so a week reads as a week. A day a supervisor adjusted takes
 * the meal break they set in place of the company's.
 */
export function personTimesheet(
  userId: string,
  shifts: readonly Shift[],
  from: string,
  to: string,
  policy: BreakPolicy,
  adjustments: readonly MealAdjustment[] = [],
): PersonTimesheet {
  const days = daysOf(from, to).map((day): TimesheetDay => {
    const ofDay = shifts.filter((shift) => shift.userId === userId && shift.day === day);
    const closed = ofDay.flatMap((shift) => (shift.minutes === null ? [] : [shift.minutes]));
    const adjusted = adjustments.find((adjustment) => adjustment.userId === userId && adjustment.day === day);
    return {
      day,
      shifts: ofDay,
      open: ofDay.some((shift) => shift.minutes === null),
      mealReason: adjusted?.reason ?? null,
      ...dayPay(closed, policy, adjusted?.mealBreakMinutes ?? null),
    };
  });
  const sum = (key: "workedMinutes" | "unpaidMinutes" | "paidMinutes") => days.reduce((total, day) => total + day[key], 0);
  return {
    userId,
    days,
    workedMinutes: sum("workedMinutes"),
    unpaidMinutes: sum("unpaidMinutes"),
    paidMinutes: sum("paidMinutes"),
    daysWorked: days.filter((day) => day.workedMinutes > 0).length,
    flagged: days.some((day) => day.shifts.some((shift) => shift.minutes === null || shift.late || shift.leftAway)),
  };
}

export type ShiftFlag = "open" | "manual" | "edited" | "late" | "leftAway";

/** What a shift carries that somebody should know, in the order it is shown, worded by `say`. */
export function shiftFlags(shift: Shift, say: (flag: ShiftFlag) => string): string[] {
  const flags: ShiftFlag[] = [];
  if (shift.minutes === null) flags.push("open");
  if (shift.source === "MANUAL") flags.push("manual");
  if (shift.editedAt) flags.push("edited");
  if (shift.late) flags.push("late");
  if (shift.leftAway) flags.push("leftAway");
  return flags.map(say);
}

/** `h:mm`, the way a timesheet reads a duration: 7:45, 0:20. */
export function hoursAndMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}
