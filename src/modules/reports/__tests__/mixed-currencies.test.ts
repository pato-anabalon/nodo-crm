import { foldByCurrency } from "../currency";

const row = (currency: string, count: number, total: number) => ({
  currency,
  _count: { _all: count },
  _sum: { total },
});

describe("foldByCurrency", () => {
  it("adds up normally when everything is in the company's currency", () => {
    const { bucket, foreign } = foldByCurrency([row("NZD", 3, 900)], "NZD");
    expect(bucket).toEqual({ count: 3, value: 900 });
    expect(foreign).toBe(0);
  });

  /**
   * The bug this exists to prevent: 900 NZD and 400 AUD summed to 1300 of
   * nothing. The count is still 5 — that part was never currency-dependent.
   */
  it("counts every quote but only values the ones that can be added", () => {
    const { bucket, foreign } = foldByCurrency(
      [row("NZD", 3, 900), row("AUD", 2, 400)],
      "NZD",
    );
    expect(bucket).toEqual({ count: 5, value: 900 });
    expect(foreign).toBe(2);
  });

  it("reports the exclusion even when nothing is in the home currency", () => {
    const { bucket, foreign } = foldByCurrency([row("AUD", 2, 400)], "NZD");
    expect(bucket).toEqual({ count: 2, value: 0 });
    expect(foreign).toBe(2);
  });

  it("treats a missing sum as zero rather than NaN", () => {
    const { bucket } = foldByCurrency(
      [{ currency: "NZD", _count: { _all: 1 }, _sum: { total: null } }],
      "NZD",
    );
    expect(bucket.value).toBe(0);
  });

  it("is empty, not undefined, for a period with no quotes", () => {
    expect(foldByCurrency([], "NZD")).toEqual({ bucket: { count: 0, value: 0 }, foreign: 0 });
  });
});
