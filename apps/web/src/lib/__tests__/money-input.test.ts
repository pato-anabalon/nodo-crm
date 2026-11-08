import { sanitizeNumericInput } from "../money-input";

describe("sanitizeNumericInput", () => {
  it("passes a plain integer through untouched", () => {
    expect(sanitizeNumericInput("1234")).toBe("1234");
  });

  it("passes a plain decimal through untouched", () => {
    expect(sanitizeNumericInput("12.5")).toBe("12.5");
  });

  it("drops letters and currency symbols", () => {
    expect(sanitizeNumericInput("$1,234.50")).toBe("1234.50");
  });

  it("collapses a second decimal point into the first number instead of keeping it", () => {
    expect(sanitizeNumericInput("1.2.3")).toBe("1.23");
  });

  it("keeps a leading dot, same as the browser's own number field would", () => {
    expect(sanitizeNumericInput(".5")).toBe(".5");
  });

  it("keeps a trailing dot while it's being typed", () => {
    expect(sanitizeNumericInput("5.")).toBe("5.");
  });

  it("returns an empty string when nothing numeric was typed", () => {
    expect(sanitizeNumericInput("abc")).toBe("");
  });

  it("leaves an already-empty string empty", () => {
    expect(sanitizeNumericInput("")).toBe("");
  });
});
