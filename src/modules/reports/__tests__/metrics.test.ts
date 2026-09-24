import { conversionRate, daysBetween, median, percentChange } from "../metrics";

describe("percentChange", () => {
  it("reports growth and decline", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
  });

  it("reports no change as zero", () => {
    expect(percentChange(100, 100)).toBe(0);
  });

  it("refuses to compare against nothing", () => {
    // Growth from zero isn't "+100%": it has no percentage, and printing one
    // would invent a fact the data doesn't carry.
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it("handles a drop to zero", () => {
    expect(percentChange(0, 40)).toBe(-100);
  });
});

describe("conversionRate", () => {
  it("gives the share of the previous step", () => {
    expect(conversionRate(25, 100)).toBe(25);
  });

  it("is zero when there was nothing to convert", () => {
    expect(conversionRate(0, 0)).toBe(0);
    expect(conversionRate(5, 0)).toBe(0);
  });

  it("copes with a step that matches the one before it", () => {
    expect(conversionRate(10, 10)).toBe(100);
  });
});

describe("median", () => {
  it("takes the middle of an odd number of values", () => {
    expect(median([1, 9, 3])).toBe(3);
  });

  it("averages the two middles of an even number", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("is not dragged by a single outlier, as a mean would be", () => {
    // The mean here is 48.4; most quotes were answered within days.
    expect(median([1, 2, 3, 4, 232])).toBe(3);
  });

  it("has no answer for no values", () => {
    expect(median([])).toBeNull();
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween(new Date("2026-03-01T00:00:00Z"), new Date("2026-03-04T00:00:00Z"))).toBe(3);
  });

  it("keeps part of a day rather than rounding it away", () => {
    expect(daysBetween(new Date("2026-03-01T00:00:00Z"), new Date("2026-03-01T12:00:00Z"))).toBe(0.5);
  });
});
