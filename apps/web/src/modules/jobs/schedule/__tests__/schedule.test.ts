import { addDays, barInWindow, calendarWeeks, daysBetween, isDay, layoutWeek, monthStarts, shiftDates, weekStart } from "../calendar";
import { eventFromForm } from "../schemas";
import { eventWhen, scheduleFormatters } from "../view";
import { JOB_COLOURS, isJobColour, jobColour } from "../../colours";
import { jobFormSchema } from "../../schemas";

describe("days", () => {
  it("adds and counts across months and leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
    expect(daysBetween("2026-10-05", "2026-10-01")).toBe(-4);
  });

  it("starts weeks on Monday", () => {
    expect(weekStart("2026-10-15")).toBe("2026-10-12"); // a Thursday
    expect(weekStart("2026-10-12")).toBe("2026-10-12"); // the Monday itself
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // the Sunday after
  });

  it("only accepts real days", () => {
    expect(isDay("2026-10-15")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("15/10/2026")).toBe(false);
    expect(isDay(undefined)).toBe(false);
  });

  it("draws whole weeks from the Monday of the first", () => {
    const weeks = calendarWeeks("2026-10-15", 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0][0]).toBe("2026-10-12");
    expect(weeks[1][6]).toBe("2026-10-25");
  });
});

describe("layoutWeek", () => {
  const week = calendarWeeks("2026-10-12", 1)[0];
  const item = (id: string, startsOn: string, endsOn: string) => ({ id, startsOn, endsOn });

  it("draws a several-day event as one bar across its days", () => {
    const [segment] = layoutWeek(week, [item("a", "2026-10-13", "2026-10-15")]);
    expect(segment).toMatchObject({ column: 2, span: 3, lane: 0, continuesBefore: false, continuesAfter: false });
  });

  it("cuts a bar at the week's edges and says it goes on", () => {
    const [segment] = layoutWeek(week, [item("a", "2026-10-08", "2026-10-20")]);
    expect(segment).toMatchObject({ column: 1, span: 7, continuesBefore: true, continuesAfter: true });
  });

  it("stacks what overlaps, and lets what doesn't share a row", () => {
    const segments = layoutWeek(week, [
      item("long", "2026-10-12", "2026-10-14"),
      item("overlap", "2026-10-13", "2026-10-13"),
      item("after", "2026-10-15", "2026-10-16"),
    ]);
    const lane = (id: string) => segments.find((s) => s.item.id === id)!.lane;
    expect(lane("long")).toBe(0);
    expect(lane("overlap")).toBe(1);
    expect(lane("after")).toBe(0);
  });

  it("leaves out what falls in another week", () => {
    expect(layoutWeek(week, [item("a", "2026-10-20", "2026-10-21")])).toEqual([]);
  });
});

describe("barInWindow", () => {
  it("places a job's bar in days from the window's start", () => {
    expect(barInWindow("2026-10-14", "2026-10-20", "2026-10-12", 84)).toEqual({ offset: 2, length: 7, clippedStart: false, clippedEnd: false });
  });

  it("clips at the window, and drops what is outside it", () => {
    expect(barInWindow("2026-10-01", "2026-10-13", "2026-10-12", 7)).toMatchObject({ offset: 0, length: 2, clippedStart: true });
    expect(barInWindow("2026-12-01", "2026-12-05", "2026-10-12", 7)).toBeNull();
  });

  it("draws a job with one date as that day", () => {
    expect(barInWindow(null, "2026-10-14", "2026-10-12", 7)).toMatchObject({ offset: 2, length: 1 });
    expect(barInWindow(null, null, "2026-10-12", 7)).toBeNull();
  });
});

describe("monthStarts", () => {
  it("heads the window with its own month, then each first of the month", () => {
    expect(monthStarts("2026-10-12", 84, 8)).toEqual(["2026-10-12", "2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  it("drops the window's own month when the next one starts too close to share the row", () => {
    expect(monthStarts("2026-09-28", 84, 8)).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
  });

  it("has one heading for a window starting on the first", () => {
    expect(monthStarts("2026-11-01", 7, 8)).toEqual(["2026-11-01"]);
  });
});

describe("shiftDates", () => {
  const dates = { startsOn: "2026-10-12", endsOn: "2026-10-16" };

  it("moves the whole bar", () => {
    expect(shiftDates(dates, "move", 3)).toEqual({ startsOn: "2026-10-15", endsOn: "2026-10-19" });
  });

  it("stretches one end, never past the other", () => {
    expect(shiftDates(dates, "end", 2)).toEqual({ startsOn: "2026-10-12", endsOn: "2026-10-18" });
    expect(shiftDates(dates, "start", -2)).toEqual({ startsOn: "2026-10-10", endsOn: "2026-10-16" });
    expect(shiftDates(dates, "start", 10)).toEqual({ startsOn: "2026-10-16", endsOn: "2026-10-16" });
    expect(shiftDates(dates, "end", -10)).toEqual({ startsOn: "2026-10-12", endsOn: "2026-10-12" });
  });
});

describe("eventFromForm", () => {
  const form = (values: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  };

  it("reads an all-day event, with a blank end as the same day, and drops any times", () => {
    const parsed = eventFromForm(form({ title: "Scaffold up", allDay: "on", startsOn: "2026-10-20", endsOn: "", startTime: "07:00" }));
    expect(parsed.success && parsed.data).toMatchObject({ allDay: true, startsOn: "2026-10-20", endsOn: "2026-10-20", startTime: null, endTime: null });
  });

  it("reads a timed event and wants both times", () => {
    const ok = eventFromForm(form({ title: "Inspection", startsOn: "2026-10-20", startTime: "09:00", endTime: "10:30" }));
    expect(ok.success && ok.data).toMatchObject({ allDay: false, startTime: "09:00", endTime: "10:30" });
    const missing = eventFromForm(form({ title: "Inspection", startsOn: "2026-10-20", startTime: "09:00" }));
    expect(missing.success).toBe(false);
    expect(missing.error?.flatten().fieldErrors.endTime).toEqual(["jobs.schedule.validation.time"]);
  });

  it("refuses an end before the start — by day, and by time on the same day", () => {
    const days = eventFromForm(form({ title: "x", allDay: "on", startsOn: "2026-10-20", endsOn: "2026-10-19" }));
    expect(days.error?.flatten().fieldErrors.endsOn).toEqual(["jobs.validation.endBeforeStart"]);
    const times = eventFromForm(form({ title: "x", startsOn: "2026-10-20", startTime: "10:00", endTime: "09:00" }));
    expect(times.error?.flatten().fieldErrors.endTime).toEqual(["jobs.validation.endBeforeStart"]);
    const overnight = eventFromForm(form({ title: "x", startsOn: "2026-10-20", endsOn: "2026-10-21", startTime: "22:00", endTime: "06:00" }));
    expect(overnight.success).toBe(true);
  });

  it("refuses a day that isn't one and a missing title", () => {
    expect(eventFromForm(form({ title: "x", allDay: "on", startsOn: "2026-02-30" })).success).toBe(false);
    expect(eventFromForm(form({ title: " ", allDay: "on", startsOn: "2026-10-20" })).success).toBe(false);
  });

  it("reads the milestone box", () => {
    const parsed = eventFromForm(form({ title: "Handover", allDay: "on", startsOn: "2026-10-20", isMilestone: "on" }));
    expect(parsed.success && parsed.data.isMilestone).toBe(true);
  });
});

describe("eventWhen", () => {
  const f = scheduleFormatters("en-NZ", "Pacific/Auckland");
  const day = (key: string) => new Date(`${key}T00:00:00Z`);

  it("says one day, or the range", () => {
    expect(eventWhen({ allDay: true, startsOn: day("2026-10-20"), endsOn: day("2026-10-20"), startsAt: null, endsAt: null }, f)).toBe(f.day("2026-10-20"));
    expect(eventWhen({ allDay: true, startsOn: day("2026-10-20"), endsOn: day("2026-10-22"), startsAt: null, endsAt: null }, f)).toBe(
      `${f.shortDay("2026-10-20")} – ${f.shortDay("2026-10-22")}`,
    );
  });

  it("gives the times on the company's clocks", () => {
    const label = eventWhen(
      {
        allDay: false,
        startsOn: day("2026-10-20"),
        endsOn: day("2026-10-20"),
        startsAt: new Date("2026-10-19T20:30:00Z"),
        endsAt: new Date("2026-10-19T22:00:00Z"),
      },
      f,
    );
    expect(label).toMatch(/9:30/);
    expect(label).toMatch(/11:00/);
  });
});

describe("job colours", () => {
  it("keeps a colour from the palette and derives one otherwise, the same every time", () => {
    expect(jobColour({ id: "x", color: JOB_COLOURS[3] })).toBe(JOB_COLOURS[3]);
    expect(jobColour({ id: "abc", color: null })).toBe(jobColour({ id: "abc", color: "#123456" }));
    expect(isJobColour(jobColour({ id: "abc", color: null }))).toBe(true);
  });

  it("reads a colour outside the palette, from a forged post, as none", () => {
    expect(jobFormSchema.parse({ name: "Job", color: "red;background:url(x)" }).color).toBeNull();
    expect(jobFormSchema.parse({ name: "Job", color: JOB_COLOURS[0] }).color).toBe(JOB_COLOURS[0]);
    expect(jobFormSchema.parse({ name: "Job" }).color).toBeUndefined();
  });
});
