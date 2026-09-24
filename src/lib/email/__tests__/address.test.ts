import { formatAddress, formatDisplayName } from "../address";

const EMAIL = "no-reply@nodo.co.nz";

describe("formatDisplayName", () => {
  it("leaves a name without special characters as it is", () => {
    expect(formatDisplayName("Acme Ltd")).toBe("Acme Ltd");
  });

  it("quotes a name with a comma, which would otherwise read as two addresses", () => {
    expect(formatDisplayName("Acme, Ltd.")).toBe('"Acme, Ltd."');
  });

  it("escapes the quotes within the name itself", () => {
    expect(formatDisplayName('The "Best" Painters')).toBe('"The \\"Best\\" Painters"');
  });

  it("escapes the backslash before the quote", () => {
    expect(formatDisplayName('A\\B"C')).toBe('"A\\\\B\\"C"');
  });

  it("neutralises an attempt to inject another address", () => {
    const result = formatDisplayName("Smith & Sons <hack@evil.com>");
    expect(result.startsWith('"')).toBe(true);
    expect(result).toBe('"Smith & Sons <hack@evil.com>"');
  });

  it("strips line breaks, which would allow header injection", () => {
    expect(formatDisplayName("Acme\r\nBcc: victima@test.cl")).toBe(
      '"Acme Bcc: victima@test.cl"',
    );
  });

  it("returns empty when the name contributes nothing", () => {
    expect(formatDisplayName("   ")).toBe("");
    expect(formatDisplayName("\n\t")).toBe("");
  });

  it("clamps an absurdly long name", () => {
    expect(formatDisplayName("x".repeat(500)).length).toBeLessThanOrEqual(202);
  });
});

describe("formatAddress", () => {
  it("builds the sender with name and address", () => {
    expect(formatAddress("Acme Ltd", EMAIL)).toBe(`Acme Ltd <${EMAIL}>`);
  });

  it("uses only the address when there is no usable name", () => {
    expect(formatAddress("  ", EMAIL)).toBe(EMAIL);
  });

  it("the real address always stays at the end, outside the name", () => {
    const result = formatAddress("Evil <attacker@evil.com>", EMAIL);
    expect(result.endsWith(`<${EMAIL}>`)).toBe(true);
    // The injected address stays inside the quotes, inert.
    expect(result).toBe(`"Evil <attacker@evil.com>" <${EMAIL}>`);
  });
});
