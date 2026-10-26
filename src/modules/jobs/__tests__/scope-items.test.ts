import { scopeItemsFromQuote, type ScopeSource } from "../scope-items";

type Section = ScopeSource["sections"][number];

function section(over: Partial<Section> & { id: string }): Section {
  return {
    position: 0,
    title: over.id,
    body: null,
    kind: "INDEPENDENT",
    selectedByDefault: false,
    customerSelected: null,
    amount: 1000,
    discountType: "FIXED",
    discountValue: 0,
    ...over,
  };
}

describe("scopeItemsFromQuote", () => {
  it("makes one entry per line of an itemised quote, in order, with the description as the title", () => {
    const result = scopeItemsFromQuote({
      pricingMode: "ITEMIZED",
      items: [
        { position: 1, description: "Skim coat" },
        { position: 0, description: "  Base coat  " },
      ],
      sections: [],
    });
    expect(result).toEqual([
      { position: 0, title: "Base coat", body: null },
      { position: 1, title: "Skim coat", body: null },
    ]);
  });

  it("copies a section's title and write-up, sanitised, and never a figure", () => {
    const [entry] = scopeItemsFromQuote({
      pricingMode: "SECTIONS",
      items: [],
      sections: [section({ id: "a", title: "Exterior", body: "<p>Two coats</p><script>x()</script>", amount: 98765 })],
    });
    expect(entry).toEqual({ position: 0, title: "Exterior", body: "<p>Two coats</p>" });
    expect(JSON.stringify(entry)).not.toContain("98765");
    expect(Object.keys(entry).sort()).toEqual(["body", "position", "title"]);
  });

  it("leaves out an optional section the customer did not take", () => {
    const result = scopeItemsFromQuote({
      pricingMode: "SECTIONS",
      items: [],
      sections: [
        section({ id: "base", position: 0 }),
        section({ id: "opt-off", position: 1, kind: "OPTIONAL", selectedByDefault: true, customerSelected: false }),
        section({ id: "opt-on", position: 2, kind: "OPTIONAL", customerSelected: true }),
        section({ id: "opt-default", position: 3, kind: "OPTIONAL", selectedByDefault: true }),
      ],
    });
    expect(result.map((entry) => entry.title)).toEqual(["base", "opt-on", "opt-default"]);
  });

  it("keeps only the multiple-choice section that was picked", () => {
    const result = scopeItemsFromQuote({
      pricingMode: "SECTIONS",
      items: [],
      sections: [
        section({ id: "basic", position: 0, kind: "MULTIPLE_CHOICE", selectedByDefault: true }),
        section({ id: "premium", position: 1, kind: "MULTIPLE_CHOICE", customerSelected: true }),
      ],
    });
    expect(result.map((entry) => entry.title)).toEqual(["premium"]);
  });

  it("renumbers positions so the list has no gaps", () => {
    const result = scopeItemsFromQuote({
      pricingMode: "SECTIONS",
      items: [],
      sections: [
        section({ id: "a", position: 4 }),
        section({ id: "b", position: 7, kind: "OPTIONAL", customerSelected: false }),
        section({ id: "c", position: 9 }),
      ],
    });
    expect(result.map((entry) => entry.position)).toEqual([0, 1]);
  });
});
