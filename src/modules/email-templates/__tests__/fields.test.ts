import { applyFields, isEmailField, unknownFields } from "../fields";

const values = { customer: "Paula Rivas", reference: "COT-000001", company: "Acme Ltd" };

describe("unknownFields", () => {
  it("accepts the catalogue", () => {
    expect(unknownFields("Hola {{customer}}, tu {{reference}} de {{company}}")).toEqual([]);
  });

  /** The whole reason validation exists: a typo must fail in front of whoever made it. */
  it("catches a misspelling", () => {
    expect(unknownFields("Hola {{custmer}}")).toEqual(["custmer"]);
  });

  it("catches a field that was never offered", () => {
    expect(unknownFields("Son {{total}} más {{tax}}")).toEqual(["total", "tax"]);
  });

  it("reports each one once, however often it was typed", () => {
    expect(unknownFields("{{total}} y {{total}} y {{total}}")).toEqual(["total"]);
  });

  it("tolerates spacing inside the braces", () => {
    expect(unknownFields("Hola {{ customer }}")).toEqual([]);
  });

  it("is quiet about text with no fields at all", () => {
    expect(unknownFields("Adjunto la cotización.")).toEqual([]);
  });
});

describe("applyFields", () => {
  it("substitutes what it knows", () => {
    expect(applyFields("Hola {{customer}}, la {{reference}}", values)).toBe(
      "Hola Paula Rivas, la COT-000001",
    );
  });

  it("substitutes the same field wherever it appears", () => {
    expect(applyFields("{{company}} — {{company}}", values)).toBe("Acme Ltd — Acme Ltd");
  });

  it("survives the spacing the editor may leave behind", () => {
    expect(applyFields("Hola {{  customer  }}", values)).toBe("Hola Paula Rivas");
  });

  /**
   * A contact with an email but no name. Empty beats a placeholder word:
   * being addressed as "there" or "customer" reads worse than not being
   * addressed at all.
   */
  it("leaves an empty value empty", () => {
    expect(applyFields("Hola {{customer}},", { ...values, customer: "" })).toBe("Hola ,");
  });

  /**
   * Unreachable through the form, so one here means the catalogue shrank after
   * the text was saved. Showing the braces is the visible failure that gets it
   * noticed; blanking it would hide the loss inside a sentence that still reads.
   */
  it("leaves an unknown field visible rather than blanking it", () => {
    expect(applyFields("Son {{total}} en total", values)).toBe("Son {{total}} en total");
  });

  it("does not touch braces that are not a field", () => {
    expect(applyFields("Usa {esto} y {{ }} tal cual", values)).toBe("Usa {esto} y {{ }} tal cual");
  });
});

describe("isEmailField", () => {
  it.each(["customer", "reference", "company"])("knows %s", (name) => {
    expect(isEmailField(name)).toBe(true);
  });

  it.each(["total", "cliente", "Customer", ""])("rejects %s", (name) => {
    expect(isEmailField(name)).toBe(false);
  });
});
