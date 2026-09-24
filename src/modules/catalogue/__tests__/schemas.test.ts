import { catalogueItemSchema } from "../schemas";

const base = { name: "Rockcote Full Mesh Coat", unitPrice: "85.50" };

describe("catalogueItemSchema", () => {
  it("accepts a line with a name and a price", () => {
    const parsed = catalogueItemSchema.parse(base);
    expect(parsed).toMatchObject({ name: "Rockcote Full Mesh Coat", unitPrice: 85.5 });
  });

  it("takes a comma as the decimal separator", () => {
    // People type what their keyboard and their habits give them.
    expect(catalogueItemSchema.parse({ ...base, unitPrice: "85,50" }).unitPrice).toBe(85.5);
  });

  it("ignores the spaces left by typing", () => {
    expect(catalogueItemSchema.parse({ ...base, unitPrice: " 1 250.00 " }).unitPrice).toBe(1250);
  });

  it("refuses a price that isn't a number", () => {
    expect(catalogueItemSchema.safeParse({ ...base, unitPrice: "caro" }).success).toBe(false);
  });

  it("refuses an empty price rather than reading it as free", () => {
    expect(catalogueItemSchema.safeParse({ ...base, unitPrice: "" }).success).toBe(false);
  });

  it("allows a price of zero, which is a real answer", () => {
    expect(catalogueItemSchema.parse({ ...base, unitPrice: "0" }).unitPrice).toBe(0);
  });

  it("refuses a negative price", () => {
    expect(catalogueItemSchema.safeParse({ ...base, unitPrice: "-5" }).success).toBe(false);
  });

  it("needs a name", () => {
    expect(catalogueItemSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
  });

  it("turns an empty unit and description into nothing", () => {
    const parsed = catalogueItemSchema.parse({ ...base, unit: "  ", description: "" });
    expect(parsed.unit).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("keeps the unit a trade actually uses", () => {
    expect(catalogueItemSchema.parse({ ...base, unit: "m²" }).unit).toBe("m²");
  });
});
