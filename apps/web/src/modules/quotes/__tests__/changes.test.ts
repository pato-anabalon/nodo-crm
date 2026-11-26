import { quoteChanges, type QuoteSnapshot } from "../changes";

const base: QuoteSnapshot = {
  title: "Replaster — 12 Kegworth Pl",
  validUntil: "2026-12-31",
  currency: "NZD",
  taxDisplayMode: "TAX_EXCLUSIVE_INCLUSIVE_TOTAL",
  taxRate: 15,
  pricingMode: "SECTIONS",
  quoteType: null,
  projectAddress: "12 Kegworth Pl",
  termsDocumentId: "doc1",
  discount: { type: "FIXED", value: 0 },
  optionalDiscount: null,
  total: 12000,
  texts: { intro: "<p>Hello</p>", scope: "", notes: "<p>Access from the back</p>", exclusions: "", terms: "<p>50% deposit</p>" },
  items: [],
  sections: [
    { id: "s1", title: "Plastering", body: "<p>Walls</p>", amount: 9000, kind: "INDEPENDENT", selectedByDefault: true, discountType: "FIXED", discountValue: 0 },
    { id: "s2", title: "Painting", body: "<p>Two coats</p>", amount: 3000, kind: "INDEPENDENT", selectedByDefault: true, discountType: "FIXED", discountValue: 0 },
  ],
};

it("finds nothing in a save that changed nothing the customer sees", () => {
  expect(quoteChanges(base, JSON.parse(JSON.stringify(base)))).toEqual([]);
});

it("keeps short values as they were and became, and says only that a long text was edited", () => {
  const after = { ...base, validUntil: "2027-01-31", texts: { ...base.texts, terms: "<p>30% deposit</p>" } };
  expect(quoteChanges(base, after)).toEqual([
    { kind: "value", field: "validUntil", from: "2026-12-31", to: "2027-01-31" },
    { kind: "edited", field: "terms" },
  ]);
});

it("follows sections by their row: added, removed, renamed, repriced and rewritten", () => {
  const after: QuoteSnapshot = {
    ...base,
    total: 14500,
    sections: [
      { ...base.sections[0], title: "Interior plastering", amount: 9500, body: "<p>Walls and ceilings</p>" },
      { id: null, title: "Scaffolding", body: "", amount: 5000, kind: "OPTIONAL", selectedByDefault: true, discountType: "FIXED", discountValue: 0 },
    ],
  };
  expect(quoteChanges(base, after)).toEqual([
    { kind: "section", change: "renamed", from: "Plastering", to: "Interior plastering" },
    { kind: "section", change: "amount", title: "Interior plastering", from: 9000, to: 9500 },
    { kind: "section", change: "body", title: "Interior plastering" },
    { kind: "section", change: "added", title: "Scaffolding", amount: 5000 },
    { kind: "section", change: "removed", title: "Painting", amount: 3000 },
    { kind: "total", from: 12000, to: 14500 },
  ]);
});

it("matches lines by what they say, since they are replaced on every save", () => {
  const before: QuoteSnapshot = {
    ...base,
    pricingMode: "ITEMIZED",
    sections: [],
    items: [
      { description: "Gib stopping", quantity: 40, unitPrice: 25, discount: 0 },
      { description: "Skip bin", quantity: 1, unitPrice: 450, discount: 0 },
    ],
  };
  const after: QuoteSnapshot = {
    ...before,
    items: [
      { description: "Skip bin", quantity: 1, unitPrice: 450, discount: 0 },
      { description: "Gib stopping", quantity: 45, unitPrice: 25, discount: 0 },
      { description: "Sanding", quantity: 1, unitPrice: 300, discount: 0 },
    ],
  };
  expect(quoteChanges(before, after)).toEqual([
    { kind: "item", change: "changed", description: "Gib stopping", from: { quantity: 40, unitPrice: 25, discount: 0 }, to: { quantity: 45, unitPrice: 25, discount: 0 } },
    { kind: "item", change: "added", description: "Sanding", quantity: 1, unitPrice: 300 },
  ]);
});

it("ignores a discount of nothing switching how it would be counted", () => {
  expect(quoteChanges(base, { ...base, discount: { type: "PERCENT", value: 0 } })).toEqual([]);
  expect(quoteChanges(base, { ...base, discount: { type: "PERCENT", value: 10 } })).toEqual([
    { kind: "discount", from: { type: "FIXED", value: 0 }, to: { type: "PERCENT", value: 10 } },
  ]);
});

it("says a section's options changed without detailing them", () => {
  const after = { ...base, sections: [{ ...base.sections[0], kind: "OPTIONAL" }, base.sections[1]] };
  expect(quoteChanges(base, after)).toEqual([{ kind: "section", change: "options", title: "Plastering" }]);
});
