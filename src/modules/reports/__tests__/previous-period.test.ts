import { previousPeriod, resolvePeriod } from "../period";

const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("previousPeriod", () => {
  it("ends exactly where the current period starts", () => {
    const current = resolvePeriod({ kind: "month", year: 2026, index: 5 });
    expect(previousPeriod(current).to.getTime()).toBe(current.from.getTime());
  });

  it("steps back a calendar month, whatever its length", () => {
    // March has 31 days and February 28: the previous month is February whole,
    // not "the 31 days before March".
    const march = resolvePeriod({ kind: "month", year: 2026, index: 3 });
    const previous = previousPeriod(march);

    expect(iso(previous.from)).toBe("2026-02-01");
    expect(iso(previous.to)).toBe("2026-03-01");
    expect(previous.label).toBe("2026-02");
  });

  it("crosses the year boundary going back from January", () => {
    const january = resolvePeriod({ kind: "month", year: 2026, index: 1 });
    const previous = previousPeriod(january);

    expect(iso(previous.from)).toBe("2025-12-01");
    expect(previous.label).toBe("2025-12");
  });

  it("steps back a whole quarter", () => {
    const q1 = resolvePeriod({ kind: "quarter", year: 2026, index: 1 });
    const previous = previousPeriod(q1);

    expect(iso(previous.from)).toBe("2025-10-01");
    expect(previous.label).toBe("Q4 2025");
  });

  it("steps back a whole half", () => {
    const h1 = resolvePeriod({ kind: "half", year: 2026, index: 1 });
    const previous = previousPeriod(h1);

    expect(iso(previous.from)).toBe("2025-07-01");
    expect(previous.label).toBe("S2 2025");
  });

  it("steps back a whole year", () => {
    const previous = previousPeriod(resolvePeriod({ kind: "year", year: 2026 }));

    expect(iso(previous.from)).toBe("2025-01-01");
    expect(iso(previous.to)).toBe("2026-01-01");
    expect(previous.label).toBe("2025");
  });

  it("steps back the same number of days for a rolling window", () => {
    const now = new Date("2026-03-15T10:00:00Z");
    const last7 = resolvePeriod({ kind: "days", days: 7 }, now);
    const previous = previousPeriod(last7);

    expect(iso(previous.to)).toBe(iso(last7.from));
    expect(previous.to.getTime() - previous.from.getTime()).toBe(
      last7.to.getTime() - last7.from.getTime(),
    );
  });

  it("leaves a leap February whole", () => {
    const march2028 = resolvePeriod({ kind: "month", year: 2028, index: 3 });
    const previous = previousPeriod(march2028);

    expect(iso(previous.from)).toBe("2028-02-01");
    // 2028 is a leap year: 29 days, not 28.
    expect(previous.to.getTime() - previous.from.getTime()).toBe(29 * 86_400_000);
  });
});
