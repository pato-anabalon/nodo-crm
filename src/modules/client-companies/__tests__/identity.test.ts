import { normaliseCompanyName, sameCompanyName } from "../identity";

describe("normaliseCompanyName", () => {
  it("keeps the spelling people gave it", () => {
    expect(normaliseCompanyName("Scott Builders")).toBe("Scott Builders");
  });

  it("tidies the spacing a form leaves behind", () => {
    expect(normaliseCompanyName("  Scott   Builders  ")).toBe("Scott Builders");
  });

  it.each([null, undefined, "", "   "])("gives nothing back for %p", (value) => {
    expect(normaliseCompanyName(value)).toBeNull();
  });
});

describe("sameCompanyName", () => {
  it("ignores case and spacing", () => {
    expect(sameCompanyName("Scott Builders", "  scott   builders ")).toBe(true);
  });

  it("does not guess at variations of the name", () => {
    // Deliberate: merging these would fold two customers into one on a hunch.
    expect(sameCompanyName("Scott Builders", "Scott Builders Ltd")).toBe(false);
  });

  it("never matches when one side is missing", () => {
    expect(sameCompanyName("Scott Builders", null)).toBe(false);
    expect(sameCompanyName(null, null)).toBe(false);
  });
});
