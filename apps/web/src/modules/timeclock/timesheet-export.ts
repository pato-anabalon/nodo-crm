import { decimalHours, payAmount } from "@nodo/core/timeclock/pay";
import { wallClock } from "@nodo/core/zoned-time";
import { CSV_BOM, csvRow } from "@/modules/quotes/export";
import type { TimesheetPerson } from "./timesheet-service";

/**
 * The hours as a CSV for payroll, one row per person per day worked or one per
 * person for the whole window. Hours are decimal (7.75, not 7:45), because
 * that is what a payroll system multiplies; the amount is worked out from the
 * minutes, not from the rounded hours, so it is right to the cent.
 */

export const TIMESHEET_GROUPS = ["day", "person"] as const;
export type TimesheetGroup = (typeof TIMESHEET_GROUPS)[number];

/** The longest window one file covers: a quarter. */
export const MAX_EXPORT_DAYS = 92;

export const DAY_COLUMNS = [
  "person",
  "email",
  "date",
  "jobs",
  "shifts",
  "firstIn",
  "lastOut",
  "worked",
  "travel",
  "restBreaks",
  "mealBreak",
  "paid",
  "rate",
  "amount",
  "notes",
] as const;

export const PERSON_COLUMNS = ["person", "email", "days", "worked", "travel", "mealBreak", "paid", "rate", "amount", "notes"] as const;

export type ExportColumn = (typeof DAY_COLUMNS)[number] | (typeof PERSON_COLUMNS)[number];

export type ExportLabels = {
  column: (column: ExportColumn) => string;
  /** A shift still open, not counted: said in the row so the total isn't read as complete. */
  openShifts: (count: number) => string;
  /** Shifts a person entered or corrected: payroll should know which figures were typed. */
  correctedShifts: (count: number) => string;
  /** A day whose meal break a supervisor set, with why. */
  mealAdjusted: (minutes: number, reason: string) => string;
  /** Shifts the clock ended by itself — away from the job too long, travel past its limit. */
  endedByClock: (count: number) => string;
};

const byClock = (shifts: readonly { endedByClock: boolean }[]) => shifts.filter((shift) => shift.endedByClock).length;

const byHand = (shifts: readonly { source: string; editedAt: Date | null }[]) =>
  shifts.filter((shift) => shift.source === "MANUAL" || shift.editedAt !== null).length;

/** The row's notes, joined: nothing to say is an empty cell. */
const notes = (parts: readonly (string | null)[]) => parts.filter(Boolean).join("; ") || null;

export function timesheetCsv(people: readonly TimesheetPerson[], group: TimesheetGroup, timeZone: string, labels: ExportLabels): string {
  const columns = group === "day" ? DAY_COLUMNS : PERSON_COLUMNS;
  const rows = [csvRow(columns.map(labels.column))];

  for (const person of people) {
    const name = person.name ?? person.email;
    if (group === "person") {
      const open = person.sheet.days.reduce((count, day) => count + day.shifts.filter((shift) => shift.minutes === null).length, 0);
      if (person.sheet.daysWorked === 0 && open === 0) continue;
      const all = person.sheet.days.flatMap((day) => day.shifts);
      const corrected = byHand(all);
      const ended = byClock(all);
      rows.push(
        csvRow([
          name,
          person.email,
          person.sheet.daysWorked,
          decimalHours(person.sheet.workedMinutes),
          decimalHours(person.sheet.travelMinutes),
          person.sheet.unpaidMinutes,
          decimalHours(person.sheet.paidMinutes),
          person.hourlyRate,
          payAmount(person.sheet.paidMinutes, person.hourlyRate),
          notes([
            open ? labels.openShifts(open) : null,
            corrected ? labels.correctedShifts(corrected) : null,
            ended ? labels.endedByClock(ended) : null,
          ]),
        ]),
      );
      continue;
    }

    for (const day of person.sheet.days) {
      if (day.shifts.length === 0) continue;
      const closed = day.shifts.filter((shift) => shift.clockOutAt !== null);
      const open = day.shifts.length - closed.length;
      const corrected = byHand(day.shifts);
      const ended = byClock(day.shifts);
      const lastOut = closed.reduce<Date | null>((latest, shift) => (!latest || shift.clockOutAt! > latest ? shift.clockOutAt : latest), null);
      rows.push(
        csvRow([
          name,
          person.email,
          day.day,
          // Travel is on no job; the name it carries is the one it left.
          [...new Set(day.shifts.filter((shift) => shift.kind === "WORK").map((shift) => shift.jobName))].join("; "),
          day.shifts.length,
          wallClock(day.shifts[0].clockInAt, timeZone).time,
          lastOut ? wallClock(lastOut, timeZone).time : null,
          decimalHours(day.workedMinutes),
          decimalHours(day.travelMinutes),
          day.restBreaks,
          day.unpaidMinutes,
          decimalHours(day.paidMinutes),
          person.hourlyRate,
          payAmount(day.paidMinutes, person.hourlyRate),
          notes([
            open ? labels.openShifts(open) : null,
            corrected ? labels.correctedShifts(corrected) : null,
            ended ? labels.endedByClock(ended) : null,
            day.mealReason !== null ? labels.mealAdjusted(day.unpaidMinutes, day.mealReason) : null,
          ]),
        ]),
      );
    }
  }
  return CSV_BOM + rows.join("");
}
