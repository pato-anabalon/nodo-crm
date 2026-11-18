import { correctionProblem, shiftWindow, snapshot, windowFields } from "../corrections";

const zone = "Pacific/Auckland";
const now = new Date("2026-11-17T04:00:00Z"); // 5 pm in Auckland, daylight saving.

describe("shiftWindow", () => {
  it("reads the form's day and times on the company's clock", () => {
    const window = shiftWindow("2026-11-16", "07:30", "16:00", zone);
    expect(window.clockInAt.toISOString()).toBe("2026-11-15T18:30:00.000Z");
    expect(window.clockOutAt?.toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });

  it("takes an end before the start as the next morning", () => {
    const window = shiftWindow("2026-11-16", "22:00", "06:00", zone);
    expect(window.clockOutAt!.getTime() - window.clockInAt.getTime()).toBe(8 * 3_600_000);
  });

  it("leaves a shift with no end open", () => {
    expect(shiftWindow("2026-11-16", "07:30", null, zone).clockOutAt).toBeNull();
  });

  it("gives the form back what it was filled with", () => {
    expect(windowFields(shiftWindow("2026-11-16", "22:00", "06:00", zone), zone)).toEqual({ day: "2026-11-16", start: "22:00", end: "06:00" });
    expect(windowFields(shiftWindow("2026-11-16", "07:30", null, zone), zone)).toEqual({ day: "2026-11-16", start: "07:30", end: "" });
  });
});

describe("correctionProblem", () => {
  const day = (start: string, end: string | null) => shiftWindow("2026-11-16", start, end, zone);

  it("takes a shift that touches nothing", () => {
    expect(correctionProblem(day("07:00", "12:00"), [day("12:00", "16:00")], now)).toBeNull();
  });

  it("refuses one that overlaps another", () => {
    expect(correctionProblem(day("07:00", "12:30"), [day("12:00", "16:00")], now)).toBe("overlaps");
  });

  it("treats an open shift as running until now", () => {
    // Clocked in at 7 and still there: nothing can be entered over the afternoon.
    const today = (start: string, end: string | null) => shiftWindow("2026-11-17", start, end, zone);
    expect(correctionProblem(today("13:00", "15:00"), [today("07:00", null)], now)).toBe("overlaps");
    expect(correctionProblem(today("05:00", "06:30"), [today("07:00", null)], now)).toBeNull();
  });

  it("refuses the future, at either end", () => {
    const today = (start: string, end: string | null) => shiftWindow("2026-11-17", start, end, zone);
    expect(correctionProblem(today("16:00", "18:00"), [], now)).toBe("in_future");
    expect(correctionProblem(today("18:00", null), [], now)).toBe("in_future");
  });

  it("refuses a shift longer than a day, which is a day typed wrong", () => {
    const window = { clockInAt: new Date("2026-11-14T18:00:00Z"), clockOutAt: new Date("2026-11-15T19:00:00Z") };
    expect(correctionProblem(window, [], now)).toBe("too_long");
  });
});

it("keeps a shift for the log as text that reads the same years on", () => {
  expect(snapshot({ jobName: "9 Thornhill Pl", ...shiftWindow("2026-11-16", "07:30", null, zone) })).toEqual({
    jobName: "9 Thornhill Pl",
    clockInAt: "2026-11-15T18:30:00.000Z",
    clockOutAt: null,
  });
});
