import { QuoteDeclineReason } from "@/generated/prisma/enums";
import { parseQuoteItems, quoteFormSchema, quoteFormDataToInput, teamDeclineSchema } from "../schemas";

function formDataFrom(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.append(key, value);
  return fd;
}

describe("parseQuoteItems", () => {
  it("regroups the lines by index and keeps the order", () => {
    const fd = formDataFrom({
      "items[1].description": "Segunda",
      "items[1].quantity": "2",
      "items[0].description": "Primera",
      "items[0].quantity": "1",
    });

    expect(parseQuoteItems(fd)).toEqual([
      { description: "Primera", quantity: "1" },
      { description: "Segunda", quantity: "2" },
    ]);
  });

  it("discards rows with no description", () => {
    const fd = formDataFrom({
      "items[0].description": "Real",
      "items[0].quantity": "1",
      "items[1].description": "   ",
      "items[1].quantity": "1",
    });

    expect(parseQuoteItems(fd)).toHaveLength(1);
  });

  it("ignores fields that are not lines", () => {
    const fd = formDataFrom({ title: "Cotización", "items[0].description": "Real" });
    expect(parseQuoteItems(fd)).toEqual([{ description: "Real" }]);
  });
});

describe("quoteFormSchema", () => {
  it("accepts a valid form and normalises the empties to null", () => {
    const fd = formDataFrom({
      title: "Red corporativa",
      leadId: "",
      taxRate: "19",
      discount: "0",
      validUntil: "",
      notes: "",
      "items[0].description": "Switch",
      "items[0].quantity": "3",
      "items[0].unitPrice": "450000",
      "items[0].discount": "0",
    });

    const result = quoteFormSchema.safeParse(quoteFormDataToInput(fd));
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.leadId).toBeNull();
    expect(result.data.notes).toBeNull();
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].quantity).toBe(3);
  });

  it("requires at least one line", () => {
    const fd = formDataFrom({ title: "Sin líneas", taxRate: "19", discount: "0" });
    const result = quoteFormSchema.safeParse(quoteFormDataToInput(fd));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.items).toBeDefined();
  });

  it("rejects zero quantities and discounts over 100", () => {
    const base = {
      title: "Cotización",
      taxRate: 19,
      discount: 0,
      items: [{ description: "x", quantity: 0, unitPrice: 100, discount: 0 }],
    };
    expect(quoteFormSchema.safeParse(base).success).toBe(false);

    expect(
      quoteFormSchema.safeParse({
        ...base,
        items: [{ description: "x", quantity: 1, unitPrice: 100, discount: 150 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a title that is too short", () => {
    const result = quoteFormSchema.safeParse({
      title: "ab",
      items: [{ description: "x", quantity: 1, unitPrice: 1, discount: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an overall percentage discount over 100", () => {
    const result = quoteFormSchema.safeParse({
      title: "Cotización",
      discountType: "PERCENT",
      discount: 200,
      sections: [],
      items: [{ description: "x", quantity: 1, unitPrice: 100, discount: 0 }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.discount).toBeDefined();
  });

  it("rejects a bundle discount over 100% but allows a flat amount of the same size", () => {
    const base = {
      title: "Cotización",
      sections: [],
      items: [{ description: "x", quantity: 1, unitPrice: 100, discount: 0 }],
    };

    expect(
      quoteFormSchema.safeParse({
        ...base,
        optionalDiscountType: "PERCENT",
        optionalDiscountValue: "200",
      }).success,
    ).toBe(false);

    expect(
      quoteFormSchema.safeParse({
        ...base,
        optionalDiscountType: "FIXED",
        optionalDiscountValue: "200",
      }).success,
    ).toBe(true);
  });
});

describe("teamDeclineSchema", () => {
  it("asks for a reason every time", () => {
    const result = teamDeclineSchema.safeParse({ reason: undefined, note: "" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.reason).toEqual(["quotes.decline.reasonRequired"]);
  });

  it("refuses a reason that isn't on the list", () => {
    expect(teamDeclineSchema.safeParse({ reason: "BORED", note: null }).success).toBe(false);
  });

  it("takes a listed reason with no note, and keeps a blank note as none", () => {
    expect(teamDeclineSchema.parse({ reason: QuoteDeclineReason.PRICE, note: "  " })).toEqual({
      reason: QuoteDeclineReason.PRICE,
      note: null,
    });
  });

  it("keeps a note beside a listed reason", () => {
    expect(teamDeclineSchema.parse({ reason: QuoteDeclineReason.REPLACED, note: " See COT-000412 " }).note).toBe(
      "See COT-000412",
    );
  });

  it("needs the note when the reason is Other, because the note is the reason", () => {
    const missing = teamDeclineSchema.safeParse({ reason: QuoteDeclineReason.OTHER, note: "" });
    expect(missing.success).toBe(false);
    expect(missing.error?.flatten().fieldErrors.note).toEqual(["quotes.decline.noteRequired"]);
    expect(teamDeclineSchema.safeParse({ reason: QuoteDeclineReason.OTHER, note: "Builder went bust" }).success).toBe(true);
  });
});
