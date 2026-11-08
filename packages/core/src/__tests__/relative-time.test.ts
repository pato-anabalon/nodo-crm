import { ABSOLUTE_AFTER_DAYS, elapsed } from "../relative-time";

const NOW = new Date("2026-09-23T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

describe("elapsed", () => {
  it.each([
    [0, "now"],
    [30 * 1000, "now"],
    [MINUTE, "minutes"],
    [59 * MINUTE, "minutes"],
    [HOUR, "hours"],
    [23 * HOUR, "hours"],
    [DAY, "days"],
    [6 * DAY, "days"],
  ])("%i ms ago reads as %s", (ms, unit) => {
    expect(elapsed(ago(ms), NOW).unit).toBe(unit);
  });

  /**
   * "4 weeks ago" makes the reader count backwards from today. At that distance
   * the real date says more than the gap does.
   */
  it("hands over to a date once the gap stops helping", () => {
    expect(elapsed(ago(ABSOLUTE_AFTER_DAYS * DAY), NOW).unit).toBe("date");
    expect(elapsed(ago(60 * DAY), NOW).unit).toBe("date");
  });

  it("rounds down, so nothing is older than it is", () => {
    expect(elapsed(ago(119 * MINUTE), NOW)).toEqual({ unit: "hours", value: 1 });
    expect(elapsed(ago(47 * HOUR), NOW)).toEqual({ unit: "days", value: 1 });
  });

  /** A clock a little ahead shouldn't produce a negative gap or a future date. */
  it("reads a moment in the near future as just now", () => {
    expect(elapsed(new Date(NOW.getTime() + 30_000), NOW).unit).toBe("now");
  });

  it("counts the exact boundaries as the larger unit", () => {
    expect(elapsed(ago(MINUTE), NOW)).toEqual({ unit: "minutes", value: 1 });
    expect(elapsed(ago(HOUR), NOW)).toEqual({ unit: "hours", value: 1 });
    expect(elapsed(ago(DAY), NOW)).toEqual({ unit: "days", value: 1 });
  });
});
