import { resolvePeriod } from "../period";
import { acceptanceRate, buildSeries, bucketStart, rollingSum } from "../series";

const NOW = new Date("2026-09-18T12:00:00Z");
const quote = (date: string, value: number, accepted = false) => ({
  at: new Date(`${date}T10:00:00Z`),
  value,
  accepted,
});

describe("bucketStart", () => {
  it("by day it truncates the time", () => {
    expect(bucketStart(new Date("2026-09-18T23:59:00Z"), "day").toISOString()).toBe(
      "2026-09-18T00:00:00.000Z",
    );
  });

  it("by month it goes to the 1st", () => {
    expect(bucketStart(new Date("2026-09-18T10:00:00Z"), "month").toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("by week it steps back to Monday", () => {
    // 2026-09-18 is a Friday; its Monday is the 14th.
    expect(bucketStart(new Date("2026-09-18T10:00:00Z"), "week").toISOString()).toBe(
      "2026-09-14T00:00:00.000Z",
    );
  });

  it("a Monday stays where it is", () => {
    expect(bucketStart(new Date("2026-09-14T10:00:00Z"), "week").toISOString()).toBe(
      "2026-09-14T00:00:00.000Z",
    );
  });

  it("a Sunday belongs to the week that started the previous Monday", () => {
    expect(bucketStart(new Date("2026-09-20T10:00:00Z"), "week").toISOString()).toBe(
      "2026-09-14T00:00:00.000Z",
    );
  });
});

describe("buildSeries", () => {
  const period = resolvePeriod({ kind: "month", year: 2026, index: 9 }, NOW);

  it("creates one point per day of the month, empty ones included", () => {
    const series = buildSeries([quote("2026-09-05", 100)], period, "day");
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ date: "2026-09-01", total: 0, accepted: 0 });
    expect(series[4]).toEqual({ date: "2026-09-05", total: 100, accepted: 0 });
  });

  it("days with no activity stay at zero, they are not skipped", () => {
    const series = buildSeries([], period, "day");
    expect(series).toHaveLength(30);
    expect(series.every((point) => point.total === 0)).toBe(true);
  });

  it("sums several quotes from the same day", () => {
    const series = buildSeries(
      [quote("2026-09-05", 100), quote("2026-09-05", 250)],
      period,
      "day",
    );
    expect(series[4].total).toBe(350);
  });

  it("separates the accepted figure from the total", () => {
    const series = buildSeries(
      [quote("2026-09-05", 100, true), quote("2026-09-05", 250, false)],
      period,
      "day",
    );
    expect(series[4]).toEqual({ date: "2026-09-05", total: 350, accepted: 100 });
  });

  it("discards what falls outside the period instead of inventing a bucket", () => {
    const series = buildSeries([quote("2026-08-20", 999)], period, "day");
    expect(series.every((point) => point.total === 0)).toBe(true);
  });

  it("groups a year by month into twelve points", () => {
    const year = resolvePeriod({ kind: "year", year: 2026 }, NOW);
    const series = buildSeries([quote("2026-03-10", 500)], year, "month");

    expect(series).toHaveLength(12);
    expect(series[2]).toEqual({ date: "2026-03-01", total: 500, accepted: 0 });
  });
});

describe("rollingSum", () => {
  const points = [
    { date: "2026-09-01", total: 10, accepted: 5 },
    { date: "2026-09-02", total: 20, accepted: 0 },
    { date: "2026-09-03", total: 30, accepted: 10 },
    { date: "2026-09-04", total: 40, accepted: 0 },
  ];

  it("accumulates the window backwards", () => {
    const rolled = rollingSum(points, 3, "day");
    expect(rolled.map((p) => p.total)).toEqual([10, 30, 60, 90]);
  });

  it("the first points use whatever is there, without inventing zeros", () => {
    expect(rollingSum(points, 7, "day")[0].total).toBe(10);
  });

  it("applies the window to the accepted figure too", () => {
    expect(rollingSum(points, 3, "day").map((p) => p.accepted)).toEqual([5, 5, 15, 10]);
  });

  it("with a one-day window it returns the series unchanged", () => {
    expect(rollingSum(points, 1, "day").map((p) => p.total)).toEqual([10, 20, 30, 40]);
  });

  it("fits the window to the grain: 30 days over weeks is ~4 points", () => {
    const weekly = [1, 1, 1, 1, 1, 1].map((v, i) => ({
      date: `2026-09-0${i + 1}`,
      total: v,
      accepted: 0,
    }));
    expect(rollingSum(weekly, 30, "week")[5].total).toBe(4);
  });

  it("keeps the number of points", () => {
    expect(rollingSum(points, 3, "day")).toHaveLength(points.length);
  });
});

describe("acceptanceRate", () => {
  it("works out the accepted percentage", () => {
    expect(acceptanceRate(27, 100)).toBe(27);
    expect(acceptanceRate(1, 3)).toBe(33);
  });

  it("with no quotes there is no rate to show", () => {
    expect(acceptanceRate(0, 0)).toBe(0);
  });
});
