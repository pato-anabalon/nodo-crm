import { calculateQuoteTotals, lineTotal, round2, taxIsInTotal } from "../totals";
import { formatQuoteNumber } from "@/lib/format";

describe("round2", () => {
  it("rounds to two decimals, half-up", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("does not break on non-finite values", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("lineTotal", () => {
  it("multiplies quantity by price", () => {
    expect(lineTotal({ quantity: 3, unitPrice: 450000 })).toBe(1350000);
  });

  it("applies the line's percentage discount", () => {
    expect(lineTotal({ quantity: 1, unitPrice: 900000, discount: 10 })).toBe(810000);
  });

  it("treats negative quantities and prices as zero", () => {
    expect(lineTotal({ quantity: -5, unitPrice: 1000 })).toBe(0);
    expect(lineTotal({ quantity: 2, unitPrice: -1000 })).toBe(0);
  });

  it("clamps the discount to the 0-100 range", () => {
    expect(lineTotal({ quantity: 1, unitPrice: 1000, discount: 150 })).toBe(0);
    expect(lineTotal({ quantity: 1, unitPrice: 1000, discount: -20 })).toBe(1000);
  });
});

describe("calculateQuoteTotals", () => {
  it("sums lines, applies tax and returns the total", () => {
    const totals = calculateQuoteTotals({
      items: [
        { description: "a", quantity: 3, unitPrice: 450000 },
        { description: "b", quantity: 1, unitPrice: 900000, discount: 10 },
      ] as never,
      taxRate: 19,
    });

    expect(totals.subtotal).toBe(2160000);
    expect(totals.taxAmount).toBe(410400);
    expect(totals.total).toBe(2570400);
  });

  it("applies the overall discount before tax", () => {
    const totals = calculateQuoteTotals({
      items: [{ quantity: 1, unitPrice: 100000 }],
      taxRate: 19,
      discount: 10000,
    });

    expect(totals.taxableBase).toBe(90000);
    expect(totals.taxAmount).toBe(17100);
    expect(totals.total).toBe(107100);
  });

  it("never leaves a negative total even when the discount exceeds the subtotal", () => {
    const totals = calculateQuoteTotals({
      items: [{ quantity: 1, unitPrice: 1000 }],
      taxRate: 19,
      discount: 999999,
    });

    expect(totals.discount).toBe(1000);
    expect(totals.taxableBase).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("returns zeros when there are no lines", () => {
    const totals = calculateQuoteTotals({ items: [], taxRate: 19 });
    expect(totals).toMatchObject({ subtotal: 0, taxAmount: 0, total: 0 });
  });

  it("does not accumulate floating-point error when summing many lines", () => {
    const items = Array.from({ length: 10 }, () => ({ quantity: 1, unitPrice: 0.1 }));
    expect(calculateQuoteTotals({ items }).subtotal).toBe(1);
  });
});

describe("formatQuoteNumber", () => {
  it("pads with zeros and prefixes the company's prefix", () => {
    expect(formatQuoteNumber("COT", 42)).toBe("COT-000042");
    expect(formatQuoteNumber("PROP", 1234567)).toBe("PROP-1234567");
  });
});

describe("calculateQuoteTotals — by sections", () => {
  it("sums the section amounts, with no lines", () => {
    const totals = calculateQuoteTotals({ sections: [68575.5, 16241.25], taxRate: 15 });

    expect(totals.lineTotals).toEqual([]);
    expect(totals.subtotal).toBe(84816.75);
    expect(totals.taxAmount).toBe(12722.51);
    expect(totals.total).toBe(97539.26);
  });

  it("a single section is the single-price case", () => {
    const totals = calculateQuoteTotals({ sections: [4250], taxRate: 15 });
    expect(totals.subtotal).toBe(4250);
    expect(totals.total).toBe(4887.5);
  });

  it("sections win over lines when both arrive", () => {
    const totals = calculateQuoteTotals({
      items: [{ quantity: 99, unitPrice: 99999 }],
      sections: [5000],
      taxRate: 15,
    });
    expect(totals.subtotal).toBe(5000);
  });

  it("an empty section list gives zero, it does not fall back to the lines", () => {
    const totals = calculateQuoteTotals({
      items: [{ quantity: 1, unitPrice: 100 }],
      sections: [],
      taxRate: 15,
    });
    expect(totals.subtotal).toBe(0);
  });

  it("treats a negative amount as zero", () => {
    expect(calculateQuoteTotals({ sections: [1000, -500], taxRate: 15 }).subtotal).toBe(1000);
  });
});

describe("calculateQuoteTotals — TAX_INCLUSIVE", () => {
  it("pulls the tax back out instead of adding it on top", () => {
    // 4,887.50 with 15% GST inside equals 4,250 net.
    const totals = calculateQuoteTotals({
      sections: [4887.5],
      taxRate: 15,
      taxDisplayMode: "TAX_INCLUSIVE",
    });

    expect(totals.total).toBe(4887.5);
    expect(totals.subtotal).toBe(4250);
    expect(totals.taxAmount).toBe(637.5);
  });

  it("the total is exactly what was quoted, with no surprise at the end", () => {
    const totals = calculateQuoteTotals({
      sections: [1234.56, 789.01],
      taxRate: 15,
      taxDisplayMode: "TAX_INCLUSIVE",
    });
    expect(totals.total).toBe(2023.57);
  });

  it("the breakdown always reconciles with the total", () => {
    for (const amount of [999.99, 1234.56, 8888.88, 100, 0.03]) {
      const totals = calculateQuoteTotals({
        sections: [amount],
        taxRate: 15,
        taxDisplayMode: "TAX_INCLUSIVE",
      });
      expect(totals.taxableBase + totals.taxAmount).toBeCloseTo(totals.total, 2);
    }
  });

  it("the same amount gives different totals per mode, which is the point", () => {
    const excluding = calculateQuoteTotals({ sections: [1000], taxRate: 15 });
    const including = calculateQuoteTotals({
      sections: [1000],
      taxRate: 15,
      taxDisplayMode: "TAX_INCLUSIVE",
    });

    expect(excluding.total).toBe(1150);
    expect(including.total).toBe(1000);
    expect(including.subtotal).toBe(869.57);
  });

  it("the discount is entered on the same basis as the prices", () => {
    const totals = calculateQuoteTotals({
      sections: [1150],
      taxRate: 15,
      discount: 115,
      taxDisplayMode: "TAX_INCLUSIVE",
    });

    // 115 gross is taken off: the total drops from 1,150 to 1,035.
    expect(totals.total).toBe(1035);
    expect(totals.taxableBase).toBe(900);
  });

  it("with no tax, including it or not makes no difference", () => {
    const a = calculateQuoteTotals({ sections: [500], taxRate: 0 });
    const b = calculateQuoteTotals({ sections: [500], taxRate: 0, taxDisplayMode: "TAX_INCLUSIVE" });
    expect(a.total).toBe(b.total);
    expect(a.subtotal).toBe(b.subtotal);
  });

  it("applies to itemised mode as well", () => {
    const totals = calculateQuoteTotals({
      items: [{ quantity: 2, unitPrice: 575 }],
      taxRate: 15,
      taxDisplayMode: "TAX_INCLUSIVE",
    });
    expect(totals.total).toBe(1150);
    expect(totals.subtotal).toBe(1000);
  });
});

describe("calculateQuoteTotals — TAX_EXCLUSIVE", () => {
  it("computes the tax but leaves it out of the total", () => {
    const totals = calculateQuoteTotals({
      sections: [1000],
      taxRate: 15,
      taxDisplayMode: "TAX_EXCLUSIVE",
    });

    // The customer is shown the bare subtotal; the 150 of GST is quoted for
    // later, not folded in here.
    expect(totals.taxableBase).toBe(1000);
    expect(totals.taxAmount).toBe(150);
    expect(totals.total).toBe(1000);
  });

  it("the discount still comes off before the total", () => {
    const totals = calculateQuoteTotals({
      sections: [1000],
      taxRate: 15,
      discount: 100,
      taxDisplayMode: "TAX_EXCLUSIVE",
    });

    expect(totals.total).toBe(900);
  });
});

describe("calculateQuoteTotals — NO_TAX", () => {
  it("zeroes the tax regardless of what rate is sitting in the field", () => {
    const totals = calculateQuoteTotals({
      sections: [1000],
      taxRate: 15,
      taxDisplayMode: "NO_TAX",
    });

    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(1000);
  });
});

describe("taxIsInTotal", () => {
  it("is true only for the two modes whose total carries tax", () => {
    expect(taxIsInTotal("TAX_INCLUSIVE")).toBe(true);
    expect(taxIsInTotal("TAX_EXCLUSIVE_INCLUSIVE_TOTAL")).toBe(true);
    expect(taxIsInTotal("TAX_EXCLUSIVE")).toBe(false);
    expect(taxIsInTotal("NO_TAX")).toBe(false);
  });
});
