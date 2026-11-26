import { DEFAULT_BREAK_POLICY } from "@nodo/core/timeclock/pay";
import { parseHourlyRate } from "../rate";
import { hoursAndMinutes, needsReview, personTimesheet, shiftFlags, toShift, type ShiftInput } from "../timesheet";
import { timesheetCsv } from "../timesheet-export";
import { weekFrom } from "../week";

/**
 * The timesheet adds up what payroll pays, so its rules are pinned here: a
 * shift is the day it started on in the company's zone, a day's breaks come
 * from the whole day, and an open shift counts nothing until it ends.
 */

const zone = "Pacific/Auckland";
// 2026-11-09 is a Monday; Auckland is UTC+13 in November.
const at = (local: string) => new Date(`${local}+13:00`);

function shift(id: string, start: string, end: string | null, overrides: Partial<ShiftInput> = {}): ShiftInput {
  return {
    id,
    userId: "u1",
    jobId: "j1",
    jobName: "12 Kegworth Pl",
    kind: "WORK",
    source: "MOBILE",
    clockInAt: at(start),
    clockInReceivedAt: at(start),
    clockInDistanceM: 40,
    clockOutAt: end ? at(end) : null,
    clockOutReceivedAt: end ? at(end) : null,
    clockOutInside: end ? true : null,
    endedBy: end ? "PUNCH" : null,
    editedAt: null,
    note: null,
    ...overrides,
  };
}

const week = { from: "2026-11-09", to: "2026-11-15" };

describe("personTimesheet", () => {
  it("adds a day's shifts on two jobs before taking the meal break off once", () => {
    const shifts = [
      shift("a", "2026-11-09T07:00:00", "2026-11-09T11:00:00"),
      shift("b", "2026-11-09T11:30:00", "2026-11-09T15:30:00", { jobId: "j2", jobName: "3 Beach Rd" }),
    ].map((input) => toShift(input, zone));
    const sheet = personTimesheet("u1", shifts, week.from, week.to, DEFAULT_BREAK_POLICY);

    expect(sheet.days).toHaveLength(7);
    expect(sheet.days[0]).toMatchObject({ day: "2026-11-09", workedMinutes: 480, unpaidMinutes: 30, paidMinutes: 450, restBreaks: 2 });
    expect(sheet).toMatchObject({ workedMinutes: 480, paidMinutes: 450, daysWorked: 1, flagged: false });
  });

  it("puts a shift on the company's day, not UTC's", () => {
    // 06:30 on Tuesday in Auckland is still Monday in UTC.
    const [tuesday] = [shift("a", "2026-11-10T06:30:00", "2026-11-10T09:30:00")].map((input) => toShift(input, zone));
    expect(tuesday.day).toBe("2026-11-10");
  });

  it("counts an open shift as nothing yet, and flags it", () => {
    const shifts = [shift("a", "2026-11-11T07:00:00", null)].map((input) => toShift(input, zone));
    const sheet = personTimesheet("u1", shifts, week.from, week.to, DEFAULT_BREAK_POLICY);
    expect(sheet.days[2]).toMatchObject({ open: true, workedMinutes: 0, paidMinutes: 0 });
    expect(sheet.flagged).toBe(true);
  });

  it("flags a punch sent late and a clock-out away from the job", () => {
    const late = toShift(shift("a", "2026-11-09T07:00:00", "2026-11-09T09:00:00", { clockOutReceivedAt: at("2026-11-09T18:00:00") }), zone);
    const away = toShift(shift("b", "2026-11-10T07:00:00", "2026-11-10T09:00:00", { clockOutInside: false }), zone);
    expect(late).toMatchObject({ late: true, leftAway: false });
    expect(away).toMatchObject({ late: false, leftAway: true });
  });

  it("takes a supervisor's meal break for that person's day only", () => {
    const shifts = [shift("a", "2026-11-09T07:00:00", "2026-11-09T15:00:00"), shift("b", "2026-11-10T07:00:00", "2026-11-10T15:00:00")].map(
      (input) => toShift(input, zone),
    );
    const adjustments = [
      { userId: "u1", day: "2026-11-09", mealBreakMinutes: 60, reason: "Dentist" },
      { userId: "u2", day: "2026-11-10", mealBreakMinutes: 0, reason: "Somebody else" },
    ];
    const sheet = personTimesheet("u1", shifts, week.from, week.to, DEFAULT_BREAK_POLICY, adjustments);
    expect(sheet.days[0]).toMatchObject({ unpaidMinutes: 60, paidMinutes: 420, mealAdjusted: true, mealReason: "Dentist" });
    expect(sheet.days[1]).toMatchObject({ unpaidMinutes: 30, mealAdjusted: false, mealReason: null });
    expect(sheet.paidMinutes).toBe(420 + 450);
  });
});

it("writes durations the way a timesheet reads them", () => {
  expect(hoursAndMinutes(450)).toBe("7:30");
  expect(hoursAndMinutes(5)).toBe("0:05");
});

it("opens on the Monday of whatever day it is given, and on this week for nonsense", () => {
  expect(weekFrom("2026-11-12", "2026-01-01")).toEqual(week);
  expect(weekFrom("2026-02-30", "2026-11-15")).toEqual(week);
  expect(weekFrom(undefined, "2026-11-09")).toEqual(week);
});

it("reads an hourly rate as people type it", () => {
  expect(parseHourlyRate("32.5")).toBe(32.5);
  expect(parseHourlyRate("$32.50")).toBe(32.5);
  expect(parseHourlyRate("32,50")).toBe(32.5);
  expect(parseHourlyRate("  ")).toBeNull();
  expect(parseHourlyRate("32.505")).toBeUndefined();
  expect(parseHourlyRate("-3")).toBeUndefined();
  expect(parseHourlyRate("100000")).toBeUndefined();
});

describe("timesheetCsv", () => {
  const shifts = [
    shift("a", "2026-11-09T07:00:00", "2026-11-09T15:00:00"),
    shift("b", "2026-11-10T07:00:00", null),
  ].map((input) => toShift(input, zone));
  const people = [
    {
      userId: "u1",
      name: "=Wendy",
      email: "wendy@example.com",
      hourlyRate: 30,
      sheet: personTimesheet("u1", shifts, week.from, week.to, DEFAULT_BREAK_POLICY),
    },
  ];
  const labels = {
    column: (column: string) => column,
    openShifts: (count: number) => `${count} open`,
    correctedShifts: (count: number) => `${count} by hand`,
    mealAdjusted: (minutes: number, reason: string) => `meal ${minutes}: ${reason}`,
    endedByClock: (count: number) => `${count} by the clock`,
  };
  const lines = (group: "day" | "person") => timesheetCsv(people, group, zone, labels).replace(/^﻿/, "").trim().split("\r\n");

  it("writes a row per day worked, in decimal hours, the amount from the minutes", () => {
    const [header, monday, tuesday] = lines("day");
    expect(header).toBe("person,email,date,jobs,shifts,firstIn,lastOut,worked,travel,restBreaks,mealBreak,paid,rate,amount,notes");
    // A name a spreadsheet would run as a formula goes in as text.
    expect(monday).toBe("'=Wendy,wendy@example.com,2026-11-09,12 Kegworth Pl,1,07:00,15:00,8,0,2,30,7.5,30,225,");
    expect(tuesday).toBe("'=Wendy,wendy@example.com,2026-11-10,12 Kegworth Pl,1,07:00,,0,0,0,0,0,30,0,1 open");
  });

  it("writes one row per person with the window's totals", () => {
    expect(lines("person")).toEqual([
      "person,email,days,worked,travel,mealBreak,paid,rate,amount,notes",
      "'=Wendy,wendy@example.com,1,8,0,30,7.5,30,225,1 open",
    ]);
  });

  it("says in the notes which figures a person typed or adjusted", () => {
    const corrected = [shift("a", "2026-11-09T07:00:00", "2026-11-09T15:00:00", { source: "MANUAL" })].map((input) => toShift(input, zone));
    const adjusted = [{ ...people[0], sheet: personTimesheet("u1", corrected, week.from, week.to, DEFAULT_BREAK_POLICY, [{ userId: "u1", day: "2026-11-09", mealBreakMinutes: 0, reason: "No lunch" }]) }];
    const [, monday] = timesheetCsv(adjusted, "day", zone, labels).trim().split("\r\n");
    expect(monday.endsWith(",1 by hand; meal 0: No lunch")).toBe(true);
    const [, row] = timesheetCsv(adjusted, "person", zone, labels).trim().split("\r\n");
    expect(row.endsWith(",1 by hand")).toBe(true);
  });

  it("pays travel between jobs as part of the day, says how much, and names only the jobs worked", () => {
    const moved = [
      shift("a", "2026-11-09T07:00:00", "2026-11-09T11:00:00", { endedBy: "SWITCHED" }),
      shift("t", "2026-11-09T11:00:00", "2026-11-09T11:30:00", { kind: "TRAVEL", jobId: null, endedBy: "SWITCHED" }),
      shift("b", "2026-11-09T11:30:00", "2026-11-09T15:00:00", { jobId: "j2", jobName: "4 Ponsonby Rd", clockOutInside: null, endedBy: "LEFT_SITE" }),
    ].map((input) => toShift(input, zone));
    const sheet = personTimesheet("u1", moved, week.from, week.to, DEFAULT_BREAK_POLICY);
    expect(sheet).toMatchObject({ workedMinutes: 480, travelMinutes: 30, paidMinutes: 450, flagged: true });
    const [, monday] = timesheetCsv([{ ...people[0], sheet }], "day", zone, labels).trim().split("\r\n");
    expect(monday).toBe("'=Wendy,wendy@example.com,2026-11-09,12 Kegworth Pl; 4 Ponsonby Rd,3,07:00,15:00,8,0.5,2,30,7.5,30,225,1 by the clock");
  });
});

describe("the shift that marks the week", () => {
  const say = (flag: string) => flag;
  const cases = [
    shift("open", "2026-11-09T07:00:00", null),
    shift("late", "2026-11-09T07:00:00", "2026-11-09T11:00:00", { clockOutReceivedAt: at("2026-11-09T12:00:00") }),
    shift("away", "2026-11-09T07:00:00", "2026-11-09T11:00:00", { clockOutInside: false }),
    shift("clock", "2026-11-09T07:00:00", "2026-11-09T11:00:00", { endedBy: "LEFT_SITE", clockOutInside: null }),
    shift("travel", "2026-11-09T07:00:00", "2026-11-09T11:00:00", { kind: "TRAVEL", endedBy: "TRAVEL_LIMIT", clockOutInside: null }),
    shift("manual", "2026-11-09T07:00:00", "2026-11-09T11:00:00", { source: "MANUAL", editedAt: at("2026-11-10T09:00:00") }),
    shift("plain", "2026-11-09T07:00:00", "2026-11-09T11:00:00"),
  ].map((input) => toShift(input, zone));

  it("carries an amber flag exactly when it is what marks the person", () => {
    for (const one of cases) {
      const reviewed = shiftFlags(one, say).some((flag) => flag.review);
      expect([one.id, reviewed]).toEqual([one.id, needsReview(one)]);
      expect([one.id, personTimesheet("u1", [one], week.from, week.to, DEFAULT_BREAK_POLICY).flagged]).toEqual([one.id, needsReview(one)]);
    }
  });

  it("leaves travel, by hand and corrected as description, not something to look at", () => {
    const manual = cases.find((one) => one.id === "manual")!;
    expect(shiftFlags(manual, say)).toEqual([
      { label: "manual", review: false },
      { label: "edited", review: false },
    ]);
    expect(needsReview(manual)).toBe(false);
  });
});
