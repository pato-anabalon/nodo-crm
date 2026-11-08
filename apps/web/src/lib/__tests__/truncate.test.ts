import { truncate } from "../format";

describe("truncate", () => {
  it("leaves a short text alone", () => {
    expect(truncate("Kitchen replaster", 50)).toBe("Kitchen replaster");
  });

  it("leaves a text of exactly the limit alone", () => {
    const exact = "x".repeat(50);
    expect(truncate(exact, 50)).toBe(exact);
  });

  it("counts the ellipsis towards the limit", () => {
    // One character over is still one character over: the cell must not grow.
    const long = "x".repeat(51);
    expect(truncate(long, 50)).toHaveLength(50);
    expect(truncate(long, 50).endsWith("…")).toBe(true);
  });

  it("does not leave a space hanging before the ellipsis", () => {
    expect(truncate("Plaster on concrete block wall", 12)).toBe("Plaster on…");
  });

  it("shortens a real quote title", () => {
    const title = "Quote For: Plaster on Concrete Block wall — 3 Peterson Rd, Mount Wellington";
    expect(truncate(title, 50)).toBe("Quote For: Plaster on Concrete Block wall — 3 Pet…");
  });

  it("handles an empty text", () => {
    expect(truncate("", 50)).toBe("");
  });
});
