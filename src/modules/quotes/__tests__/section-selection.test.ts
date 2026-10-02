import { resolveSelectedSectionAmounts, type SelectableSection } from "../section-selection";

const independent = (id: string, amount: number): SelectableSection => ({
  id,
  amount,
  discountType: "FIXED",
  discountValue: 0,
  kind: "INDEPENDENT",
  selectedByDefault: false,
});

const optional = (id: string, amount: number, selectedByDefault = false): SelectableSection => ({
  id,
  amount,
  discountType: "FIXED",
  discountValue: 0,
  kind: "OPTIONAL",
  selectedByDefault,
});

const multipleChoice = (id: string, amount: number, selectedByDefault = false): SelectableSection => ({
  id,
  amount,
  discountType: "FIXED",
  discountValue: 0,
  kind: "MULTIPLE_CHOICE",
  selectedByDefault,
});

describe("resolveSelectedSectionAmounts — INDEPENDENT", () => {
  it("is always included, whatever the selection says", () => {
    const result = resolveSelectedSectionAmounts([independent("a", 100)], { a: false });
    expect(result.sectionsTotal).toBe(100);
  });

  it("degenerates to exactly sum(amount) with no discounts — the whole install base before this feature", () => {
    const sections = [independent("a", 100), independent("b", 250.5)];
    const result = resolveSelectedSectionAmounts(sections, {});
    expect(result.sectionsTotal).toBe(350.5);
  });
});

describe("resolveSelectedSectionAmounts — OPTIONAL", () => {
  it("is excluded by default, with no selectedByDefault and no customer choice", () => {
    const result = resolveSelectedSectionAmounts([optional("a", 100)], {});
    expect(result.sectionsTotal).toBe(0);
    expect(result.optionalSelectedCount).toBe(0);
  });

  it("ships pre-ticked when the creator marks it selectedByDefault", () => {
    const result = resolveSelectedSectionAmounts([optional("a", 100, true)], {});
    expect(result.sectionsTotal).toBe(100);
    expect(result.optionalSelectedCount).toBe(1);
  });

  it("the customer unticking a pre-selected default excludes it", () => {
    const result = resolveSelectedSectionAmounts([optional("a", 100, true)], { a: false });
    expect(result.sectionsTotal).toBe(0);
  });

  it("the customer ticking one that wasn't pre-selected includes it", () => {
    const result = resolveSelectedSectionAmounts([optional("a", 100, false)], { a: true });
    expect(result.sectionsTotal).toBe(100);
  });

  it("each selected one keeps its own discount", () => {
    const section: SelectableSection = {
      id: "a",
      amount: 1000,
      discountType: "PERCENT",
      discountValue: 10,
      kind: "OPTIONAL",
      selectedByDefault: true,
    };
    const result = resolveSelectedSectionAmounts([section], {});
    expect(result.sectionsTotal).toBe(900);
  });
});

describe("resolveSelectedSectionAmounts — MULTIPLE_CHOICE", () => {
  it("counts nothing when none is selected or defaulted", () => {
    const result = resolveSelectedSectionAmounts(
      [multipleChoice("a", 100), multipleChoice("b", 200)],
      {},
    );
    expect(result.sectionsTotal).toBe(0);
  });

  it("the one marked selectedByDefault wins when the customer hasn't chosen", () => {
    const result = resolveSelectedSectionAmounts(
      [multipleChoice("a", 100), multipleChoice("b", 200, true)],
      {},
    );
    expect(result.sectionsTotal).toBe(200);
  });

  it("an explicit customer pick overrides the creator's default", () => {
    const result = resolveSelectedSectionAmounts(
      [multipleChoice("a", 100, true), multipleChoice("b", 200)],
      { a: false, b: true },
    );
    expect(result.sectionsTotal).toBe(200);
  });

  it("switching the choice swaps which one counts, never both", () => {
    const sections = [multipleChoice("a", 100), multipleChoice("b", 200)];
    const pickedA = resolveSelectedSectionAmounts(sections, { a: true, b: false });
    const pickedB = resolveSelectedSectionAmounts(sections, { a: false, b: true });
    expect(pickedA.sectionsTotal).toBe(100);
    expect(pickedB.sectionsTotal).toBe(200);
  });

  it("two sections marked selectedByDefault by mistake never double-count — the first wins", () => {
    const result = resolveSelectedSectionAmounts(
      [multipleChoice("a", 100, true), multipleChoice("b", 200, true)],
      {},
    );
    expect(result.sectionsTotal).toBe(100);
  });

  it("two explicit customer picks (a race) never double-count — the first by order wins", () => {
    const result = resolveSelectedSectionAmounts(
      [multipleChoice("a", 100), multipleChoice("b", 200)],
      { a: true, b: true },
    );
    expect(result.sectionsTotal).toBe(100);
  });
});

describe("resolveSelectedSectionAmounts — the optional-bundle discount", () => {
  it("doesn't apply below the threshold", () => {
    const result = resolveSelectedSectionAmounts(
      [optional("a", 100, true), optional("b", 100, true)],
      {},
      { threshold: 3, type: "PERCENT", value: 10 },
    );
    expect(result.bundleDiscountApplied).toBe(0);
    expect(result.sectionsTotal).toBe(200);
  });

  it("applies once the threshold is reached, as a percentage of the selected optionals only", () => {
    const result = resolveSelectedSectionAmounts(
      [
        optional("a", 100, true),
        optional("b", 100, true),
        optional("c", 100, true),
        independent("d", 500),
      ],
      {},
      { threshold: 3, type: "PERCENT", value: 10 },
    );
    // 10% of the three $100 optionals ($300), not of the $500 independent section.
    expect(result.bundleDiscountApplied).toBe(30);
    expect(result.sectionsTotal).toBe(770);
  });

  it("applies as a flat amount, clamped to the optional base", () => {
    const result = resolveSelectedSectionAmounts(
      [optional("a", 50, true), optional("b", 50, true)],
      {},
      { threshold: 2, type: "FIXED", value: 1000 },
    );
    expect(result.bundleDiscountApplied).toBe(100);
    expect(result.sectionsTotal).toBe(0);
  });

  it("includes the multiple-choice winner in its base, but never an independent section", () => {
    const result = resolveSelectedSectionAmounts(
      [
        optional("a", 100, true),
        optional("b", 100, true),
        multipleChoice("c", 300, true),
        independent("d", 9999),
      ],
      {},
      { threshold: 2, type: "PERCENT", value: 50 },
    );
    // 50% of $100 + $100 + $300 = $500, never touching the $9,999 independent.
    expect(result.bundleDiscountApplied).toBe(250);
  });

  it("no bundle configured means no discount, regardless of count", () => {
    const result = resolveSelectedSectionAmounts(
      [optional("a", 100, true), optional("b", 100, true), optional("c", 100, true)],
      {},
      null,
    );
    expect(result.bundleDiscountApplied).toBe(0);
  });

  it("a multiple-choice winner counts as one more toward the threshold, even though only one of several could ever be picked, and its amount joins the discounted base", () => {
    const sections = [
      optional("a", 100, true),
      multipleChoice("m1", 9999),
      multipleChoice("m2", 200, true),
    ];
    const result = resolveSelectedSectionAmounts(sections, {}, {
      threshold: 2,
      type: "PERCENT",
      value: 50,
    });

    expect(result.optionalSelectedCount).toBe(1);
    expect(result.bundleEligibleCount).toBe(2);
    // The threshold is met by the winner counting, and its own $200 joins the
    // $100 optional in the base: 50% of $300 — the loser's $9,999 never does.
    expect(result.bundleDiscountApplied).toBe(150);
  });

  it("without any multiple-choice winner, only the optional count decides the threshold", () => {
    const sections = [optional("a", 100, true), multipleChoice("m1", 9999)];
    const result = resolveSelectedSectionAmounts(sections, {}, {
      threshold: 2,
      type: "PERCENT",
      value: 50,
    });

    expect(result.bundleEligibleCount).toBe(1);
    expect(result.bundleDiscountApplied).toBe(0);
  });
});

describe("resolveSelectedSectionAmounts — combined, as a real quote would mix them", () => {
  it("adds independents, selected optionals, the bundle discount and the multiple-choice pick together", () => {
    const sections = [
      independent("i1", 1000),
      independent("i2", 500),
      optional("o1", 200, true),
      optional("o2", 150, true),
      optional("o3", 100, true),
      optional("o4", 80, false),
      multipleChoice("m1", 300, true),
      multipleChoice("m2", 400),
    ];
    const result = resolveSelectedSectionAmounts(sections, {}, {
      threshold: 3,
      type: "PERCENT",
      value: 10,
    });

    // Independents: 1000 + 500 = 1500
    // Optionals selected by default: 200 + 150 + 100 = 450 (o4 stays out)
    // Multiple choice: m1 wins by default = 300
    // Bundle: 3 optionals meets the threshold of 3 → 10% of (450 + 300) = 75
    // Total: 1500 + 450 + 300 - 75 = 2175
    expect(result.optionalSelectedCount).toBe(3);
    expect(result.bundleDiscountApplied).toBe(75);
    expect(result.sectionsTotal).toBe(2175);
  });
});
