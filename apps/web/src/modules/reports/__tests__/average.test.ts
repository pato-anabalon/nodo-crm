import { measure } from "../metrics";
import { divideSeries, rollingSum, type SeriesPoint } from "../series";

describe("measure", () => {
  const bucket = { count: 4, value: 1000 };

  it("gives the total, the headcount or the typical quote", () => {
    expect(measure(bucket, "value")).toBe(1000);
    expect(measure(bucket, "count")).toBe(4);
    expect(measure(bucket, "average")).toBe(250);
  });

  it("has no average over nothing, and says zero rather than NaN", () => {
    expect(measure({ count: 0, value: 0 }, "average")).toBe(0);
    expect(Number.isNaN(measure({ count: 0, value: 0 }, "average"))).toBe(false);
  });
});

const point = (date: string, total: number, accepted: number): SeriesPoint => ({
  date,
  total,
  accepted,
});

describe("divideSeries", () => {
  it("divides the totals by the counts, bucket by bucket", () => {
    const sums = [point("2026-03-01", 900, 600), point("2026-03-02", 200, 0)];
    const counts = [point("2026-03-01", 3, 2), point("2026-03-02", 2, 0)];

    expect(divideSeries(sums, counts)).toEqual([
      point("2026-03-01", 300, 300),
      point("2026-03-02", 100, 0),
    ]);
  });

  it("leaves an empty bucket at zero instead of dividing by nothing", () => {
    const result = divideSeries([point("2026-03-01", 0, 0)], [point("2026-03-01", 0, 0)]);
    expect(result[0].total).toBe(0);
    expect(Number.isNaN(result[0].total)).toBe(false);
  });
});

describe("a rolling average", () => {
  /**
   * The reason the sums are kept apart until the end: rolling each and dividing
   * afterwards is not the same as rolling a series of averages.
   */
  it("weights by how many quotes each bucket had, not by the bucket", () => {
    // Day one: three quotes worth 900. Day two: one quote worth 100.
    const sums = [point("2026-03-01", 900, 0), point("2026-03-02", 100, 0)];
    const counts = [point("2026-03-01", 3, 0), point("2026-03-02", 1, 0)];

    const rolled = divideSeries(rollingSum(sums, 2), rollingSum(counts, 2));

    // Four quotes worth 1000 between them: 250 each.
    expect(rolled[1].total).toBe(250);

    // Averaging the two daily averages instead would give (300 + 100) / 2 = 200,
    // which counts the lone quote on day two as heavily as the three on day one.
    const wrong = rollingSum(divideSeries(sums, counts), 2);
    expect(wrong[1].total / 2).toBe(200);
  });
});
