import { breakAllowance, dayPay, decimalHours, payAmount, shiftMinutes, DEFAULT_BREAK_POLICY } from "../pay";

const law = DEFAULT_BREAK_POLICY;
const plasterPro = { restBreakMinutes: 15, mealBreakMinutes: 30 };
const h = (hours: number) => hours * 60;

describe("breakAllowance", () => {
  it("follows the law's table at each edge", () => {
    const at = (minutes: number) => {
      const { restBreaks, unpaidMinutes } = breakAllowance(minutes, law);
      return [restBreaks, unpaidMinutes];
    };
    expect(at(h(2) - 1)).toEqual([0, 0]);
    expect(at(h(2))).toEqual([1, 0]);
    expect(at(h(4))).toEqual([1, 0]);
    expect(at(h(4) + 1)).toEqual([1, 30]);
    expect(at(h(6))).toEqual([1, 30]);
    expect(at(h(6) + 1)).toEqual([2, 30]);
    expect(at(h(10) - 1)).toEqual([2, 30]);
    expect(at(h(10))).toEqual([3, 30]);
    expect(at(h(12))).toEqual([3, 30]);
    expect(at(h(14))).toEqual([3, 30]);
  });

  it("takes the company's own durations: longer paid breaks change nothing on the pay", () => {
    expect(breakAllowance(h(8), plasterPro)).toEqual({ restBreaks: 2, restBreakMinutes: 15, unpaidMinutes: 30 });
    expect(dayPay([h(8)], plasterPro).paidMinutes).toBe(dayPay([h(8)], law).paidMinutes);
  });

  it("deducts nothing for a company that pays the meal break", () => {
    expect(breakAllowance(h(8), { restBreakMinutes: 10, mealBreakMinutes: 0 }).unpaidMinutes).toBe(0);
  });
});

it("counts a shift to the nearest minute", () => {
  const start = new Date("2026-11-12T07:00:00Z");
  expect(shiftMinutes(start, new Date("2026-11-12T15:00:29Z"))).toBe(480);
  expect(shiftMinutes(start, new Date("2026-11-12T15:00:30Z"))).toBe(481);
  expect(shiftMinutes(start, start)).toBe(0);
});

describe("dayPay", () => {
  it("adds a day's shifts before deciding its breaks", () => {
    // Two jobs of three hours: six hours worked, so a meal break comes off once.
    expect(dayPay([h(3), h(3)], law)).toEqual({ workedMinutes: 360, paidMinutes: 330, restBreaks: 1, restBreakMinutes: 10, unpaidMinutes: 30 });
  });

  it("is nothing on a day with no shifts", () => {
    expect(dayPay([], law)).toMatchObject({ workedMinutes: 0, paidMinutes: 0, unpaidMinutes: 0 });
  });
});

it("pays to the cent and says nothing without a rate", () => {
  expect(payAmount(450, 32.5)).toBe(243.75);
  expect(payAmount(7, 29.99)).toBe(3.5);
  expect(payAmount(450, null)).toBeNull();
});

it("writes minutes as decimal hours", () => {
  expect(decimalHours(465)).toBe(7.75);
  expect(decimalHours(20)).toBe(0.33);
});
