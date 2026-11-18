/**
 * From shifts to hours paid. Pure, so the timesheet, the export and the phone
 * add up the same way and it is checked without a database.
 *
 * Time is counted to the minute. A day's breaks follow New Zealand's minimum
 * (Employment Relations Act, rest and meal breaks) by the hours worked that
 * day, every shift of it together: paid rest breaks change nothing on the pay
 * — they are listed so the timesheet says what was owed — and the unpaid meal
 * break comes off. How long each lasts is the company's (`BreakPolicy`): the
 * law sets 10 and 30 minutes as the floor, and a company may give more.
 */

export type BreakPolicy = {
  /** Each paid rest break, in minutes. */
  restBreakMinutes: number;
  /** The unpaid meal break, in minutes; 0 when the company pays it. */
  mealBreakMinutes: number;
};

export const DEFAULT_BREAK_POLICY: BreakPolicy = { restBreakMinutes: 10, mealBreakMinutes: 30 };

/**
 * What a company may choose. Never shorter than the law's 10 and 30 — but a
 * meal break the company pays is 0, nothing coming off.
 */
export const REST_BREAK_OPTIONS = [10, 15, 20, 30] as const;
export const MEAL_BREAK_OPTIONS = [0, 30, 45, 60] as const;

/** The longest meal break a supervisor may record for one day — the database holds it to the same. */
export const MEAL_BREAK_MAX_MINUTES = 240;

export type BreakAllowance = {
  restBreaks: number;
  restBreakMinutes: number;
  /** Comes off the hours paid. */
  unpaidMinutes: number;
};

/**
 * The breaks a day of `workedMinutes` carries:
 *
 * | Worked            | Paid rest | Unpaid meal |
 * |-------------------|-----------|-------------|
 * | under 2 h         | 0         | no          |
 * | 2 h to 4 h        | 1         | no          |
 * | over 4 h to 6 h   | 1         | yes         |
 * | over 6 h, under 10| 2         | yes         |
 * | 10 h and over     | 3         | yes         |
 *
 * The law's table ends at 12 hours; a longer day keeps the last row rather
 * than inventing one.
 */
export function breakAllowance(workedMinutes: number, policy: BreakPolicy): BreakAllowance {
  const hours = workedMinutes / 60;
  const restBreaks = hours < 2 ? 0 : hours <= 6 ? 1 : hours < 10 ? 2 : 3;
  const meal = hours > 4;
  return {
    restBreaks,
    restBreakMinutes: policy.restBreakMinutes,
    // Never more than the day itself.
    unpaidMinutes: meal ? Math.min(policy.mealBreakMinutes, workedMinutes) : 0,
  };
}

/** A shift's length to the minute: 7 h 59 m 31 s is 8 hours, 7 h 59 m 29 s is not. */
export function shiftMinutes(clockInAt: Date, clockOutAt: Date): number {
  return Math.max(0, Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60_000));
}

export type DayPay = BreakAllowance & {
  workedMinutes: number;
  paidMinutes: number;
  /** The meal break came from a supervisor's adjustment, not the table. */
  mealAdjusted: boolean;
};

/**
 * A person's day: the shifts' minutes added up, then the day's breaks.
 *
 * `mealBreakMinutes` is a supervisor's word on what was actually taken that
 * day — an hour at the dentist, a lunch skipped to leave early — and replaces
 * the table's meal break whatever the day's length: it is a fact about the
 * day, not an entitlement. Still never more than the day itself.
 */
export function dayPay(shiftMinutesOfDay: readonly number[], policy: BreakPolicy, mealBreakMinutes: number | null = null): DayPay {
  const workedMinutes = shiftMinutesOfDay.reduce((sum, minutes) => sum + minutes, 0);
  const breaks = breakAllowance(workedMinutes, policy);
  const unpaidMinutes = mealBreakMinutes === null ? breaks.unpaidMinutes : Math.min(mealBreakMinutes, workedMinutes);
  return { ...breaks, unpaidMinutes, workedMinutes, paidMinutes: workedMinutes - unpaidMinutes, mealAdjusted: mealBreakMinutes !== null };
}

/** What `paidMinutes` earn at `hourlyRate`, to the cent; null with no rate. */
export function payAmount(paidMinutes: number, hourlyRate: number | null): number | null {
  if (hourlyRate === null) return null;
  return Math.round(paidMinutes * hourlyRate * 100 / 60) / 100;
}

/** Minutes as decimal hours to the hundredth — how payroll reads them (7 h 45 m is 7.75). */
export function decimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
