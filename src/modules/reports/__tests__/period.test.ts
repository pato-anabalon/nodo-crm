import {
  bucketSize,
  currentQuarter,
  periodDays,
  periodFromParams,
  resolvePeriod,
} from "../period";

const NOW = new Date("2026-09-18T15:30:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("resolvePeriod — month", () => {
  it("covers the whole month", () => {
    const p = resolvePeriod({ kind: "month", year: 2026, index: 9 }, NOW);
    expect(iso(p.from)).toBe("2026-09-01");
    expect(iso(p.to)).toBe("2026-10-01");
  });

  it("December closes in January of the following year", () => {
    const p = resolvePeriod({ kind: "month", year: 2026, index: 12 }, NOW);
    expect(iso(p.from)).toBe("2026-12-01");
    expect(iso(p.to)).toBe("2027-01-01");
  });

  it("February in a leap year lasts 29 days", () => {
    expect(periodDays(resolvePeriod({ kind: "month", year: 2028, index: 2 }, NOW))).toBe(29);
  });

  it("February in a common year lasts 28", () => {
    expect(periodDays(resolvePeriod({ kind: "month", year: 2026, index: 2 }, NOW))).toBe(28);
  });

  it("clamps an out-of-range month instead of producing nonsense", () => {
    expect(iso(resolvePeriod({ kind: "month", year: 2026, index: 13 }, NOW).from)).toBe("2026-12-01");
    expect(iso(resolvePeriod({ kind: "month", year: 2026, index: 0 }, NOW).from)).toBe("2026-01-01");
  });
});

describe("resolvePeriod — quarter", () => {
  it.each([
    [1, "2026-01-01", "2026-04-01"],
    [2, "2026-04-01", "2026-07-01"],
    [3, "2026-07-01", "2026-10-01"],
    [4, "2026-10-01", "2027-01-01"],
  ])("Q%i runs from %s to %s", (index, from, to) => {
    const p = resolvePeriod({ kind: "quarter", year: 2026, index }, NOW);
    expect(iso(p.from)).toBe(from);
    expect(iso(p.to)).toBe(to);
  });

  it("the four quarters cover the year with no gaps or overlaps", () => {
    const quarters = [1, 2, 3, 4].map((index) =>
      resolvePeriod({ kind: "quarter", year: 2026, index }, NOW),
    );
    for (let i = 1; i < quarters.length; i++) {
      expect(quarters[i].from.getTime()).toBe(quarters[i - 1].to.getTime());
    }
    const total = quarters.reduce((acc, q) => acc + periodDays(q), 0);
    expect(total).toBe(365);
  });
});

describe("resolvePeriod — half", () => {
  it("S1 and S2 split the year in two", () => {
    const s1 = resolvePeriod({ kind: "half", year: 2026, index: 1 }, NOW);
    const s2 = resolvePeriod({ kind: "half", year: 2026, index: 2 }, NOW);

    expect(iso(s1.from)).toBe("2026-01-01");
    expect(iso(s1.to)).toBe("2026-07-01");
    expect(iso(s2.from)).toBe("2026-07-01");
    expect(iso(s2.to)).toBe("2027-01-01");
    expect(periodDays(s1) + periodDays(s2)).toBe(365);
  });
});

describe("resolvePeriod — year", () => {
  it("covers the whole year", () => {
    const p = resolvePeriod({ kind: "year", year: 2026 }, NOW);
    expect(iso(p.from)).toBe("2026-01-01");
    expect(iso(p.to)).toBe("2027-01-01");
  });

  it("uses the current year when none is given", () => {
    expect(resolvePeriod({ kind: "year" }, NOW).label).toBe("2026");
  });
});

describe("resolvePeriod — last N days", () => {
  it("includes the whole of today", () => {
    const p = resolvePeriod({ kind: "days", days: 7 }, NOW);
    expect(iso(p.to)).toBe("2026-09-19");
    expect(iso(p.from)).toBe("2026-09-12");
    expect(periodDays(p)).toBe(7);
  });

  it('"last day" is only today', () => {
    const p = resolvePeriod({ kind: "days", days: 1 }, NOW);
    expect(iso(p.from)).toBe("2026-09-18");
    expect(periodDays(p)).toBe(1);
  });

  it("crosses the year boundary without breaking", () => {
    const p = resolvePeriod({ kind: "days", days: 30 }, new Date("2027-01-05T10:00:00Z"));
    expect(iso(p.from)).toBe("2026-12-07");
    expect(iso(p.to)).toBe("2027-01-06");
  });

  it("does not accept an absurd range", () => {
    expect(periodDays(resolvePeriod({ kind: "days", days: 0 }, NOW))).toBe(1);
    expect(periodDays(resolvePeriod({ kind: "days", days: 99999 }, NOW))).toBe(3650);
  });
});

describe("currentQuarter", () => {
  it.each([
    ["2026-01-15", 1],
    ["2026-03-31", 1],
    ["2026-04-01", 2],
    ["2026-09-18", 3],
    ["2026-12-31", 4],
  ])("%s falls in Q%i", (date, expected) => {
    expect(currentQuarter(new Date(`${date}T12:00:00`))).toBe(expected);
  });
});

describe("bucketSize", () => {
  it("a month is grouped by day", () => {
    expect(bucketSize(resolvePeriod({ kind: "month", year: 2026, index: 9 }, NOW))).toBe("day");
  });

  it("a quarter is grouped by week", () => {
    expect(bucketSize(resolvePeriod({ kind: "quarter", year: 2026, index: 3 }, NOW))).toBe("week");
  });

  it("a year is grouped by month", () => {
    expect(bucketSize(resolvePeriod({ kind: "year", year: 2026 }, NOW))).toBe("month");
  });

  it("a week also goes by day", () => {
    expect(bucketSize(resolvePeriod({ kind: "days", days: 7 }, NOW))).toBe("day");
  });
});

describe("periodFromParams", () => {
  it("falls back to the current year with no parameters", () => {
    expect(periodFromParams({}, NOW).label).toBe("2026");
  });

  it("reads quarter and year from the URL", () => {
    const p = periodFromParams({ period: "quarter", year: "2025", index: "2" }, NOW);
    expect(p.label).toBe("Q2 2025");
  });

  it("ignores values that are not numbers", () => {
    expect(periodFromParams({ period: "year", year: "abc" }, NOW).label).toBe("2026");
  });

  it("an invented period kind falls back to year", () => {
    expect(periodFromParams({ period: "inventado" }, NOW).kind).toBe("year");
  });

  it("takes the first value when the parameter arrives repeated", () => {
    expect(periodFromParams({ period: ["quarter", "month"], index: "1" }, NOW).kind).toBe("quarter");
  });
});
