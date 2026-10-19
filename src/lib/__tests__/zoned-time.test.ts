import { wallClock, zonedInstant } from "../zoned-time";

describe("zonedInstant", () => {
  it("reads a time on Auckland's clocks, summer and winter", () => {
    // NZDT is UTC+13, NZST UTC+12.
    expect(zonedInstant("2026-01-15", "07:30", "Pacific/Auckland").toISOString()).toBe("2026-01-14T18:30:00.000Z");
    expect(zonedInstant("2026-07-15", "07:30", "Pacific/Auckland").toISOString()).toBe("2026-07-14T19:30:00.000Z");
  });

  it("gets the days either side of a daylight-saving change right", () => {
    // New Zealand moves to NZDT at 02:00 on 27 September 2026.
    expect(zonedInstant("2026-09-26", "09:00", "Pacific/Auckland").toISOString()).toBe("2026-09-25T21:00:00.000Z");
    expect(zonedInstant("2026-09-27", "09:00", "Pacific/Auckland").toISOString()).toBe("2026-09-26T20:00:00.000Z");
  });

  it("works west of Greenwich too", () => {
    expect(zonedInstant("2026-03-02", "18:00", "America/Santiago").toISOString()).toBe("2026-03-02T21:00:00.000Z");
  });
});

describe("wallClock", () => {
  it("is the inverse: what the clocks read at an instant", () => {
    const instant = zonedInstant("2026-10-20", "16:45", "Pacific/Auckland");
    expect(wallClock(instant, "Pacific/Auckland")).toEqual({ day: "2026-10-20", time: "16:45" });
  });

  it("can land on a different day than UTC's", () => {
    expect(wallClock(new Date("2026-10-19T20:00:00Z"), "Pacific/Auckland")).toEqual({ day: "2026-10-20", time: "09:00" });
  });
});
