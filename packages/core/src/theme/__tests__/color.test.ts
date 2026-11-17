import { auroraPalette, hexToOklch, oklchToHex, parseHex } from "../color";

describe("parseHex", () => {
  it("accepts it with and without a hash, and in short form", () => {
    expect(parseHex("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHex("000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex("#fff")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("rejects invalid values", () => {
    expect(parseHex("nope")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("")).toBeNull();
  });
});

describe("hexToOklch", () => {
  it("converts white and black to the extremes of lightness", () => {
    expect(hexToOklch("#ffffff")?.l).toBeCloseTo(1, 2);
    expect(hexToOklch("#000000")?.l).toBeCloseTo(0, 2);
  });

  it("produces a css value usable as a custom property", () => {
    expect(hexToOklch("#2563eb")?.css).toMatch(/^oklch\(\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?\)$/);
  });

  it("picks dark text on light colours and light text on dark ones", () => {
    expect(hexToOklch("#fef08a")?.readableForeground).toBe("oklch(0.15 0 0)");
    expect(hexToOklch("#1e3a8a")?.readableForeground).toBe("oklch(0.99 0 0)");
  });

  it("returns null when the colour cannot be read", () => {
    expect(hexToOklch("azul")).toBeNull();
  });

  it("a grey has no chroma", () => {
    expect(hexToOklch("#808080")?.c).toBeCloseTo(0, 2);
  });
});

describe("auroraPalette", () => {
  it("returns three distinct oklch colours", () => {
    const [a, b, c] = auroraPalette("#2563eb", "#0f172a");
    expect(new Set([a, b, c]).size).toBe(3);
    for (const colour of [a, b, c]) {
      expect(colour).toMatch(/^oklch\(\d+(\.\d+)? \d+(\.\d+)? -?\d+(\.\d+)?\)$/);
    }
  });

  it("keeps the primary's hue in the first blob", () => {
    const primaryHue = hexToOklch("#2563eb")!.h;
    const [first] = auroraPalette("#2563eb", "#0f172a");
    expect(first).toContain(` ${primaryHue})`);
  });

  it("still produces three different blobs when primary and accent share a hue", () => {
    const [a, b, c] = auroraPalette("#2563eb", "#1d4ed8");
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("blends orange and blue through red/magenta, not through green", () => {
    // A fixed +150° rotation once stood in for the third blob: for an orange
    // brand that lands on teal, a colour nothing in its palette suggested.
    const [, , third] = auroraPalette("#e2622c", "#2563eb");
    const hue = Number(third.match(/ (\d+(?:\.\d+)?)\)$/)![1]);
    expect(hue < 90 || hue > 200).toBe(true);
  });

  it("clamps lightness and chroma into a band that reads as a soft blob", () => {
    // Near-black: far outside a usable blob lightness on its own.
    const [a] = auroraPalette("#020617", "#0f172a");
    const match = a.match(/^oklch\(([\d.]+) ([\d.]+) /);
    expect(Number(match![1])).toBeGreaterThanOrEqual(0.55);
    expect(Number(match![2])).toBeLessThanOrEqual(0.22);
  });

  it("falls back to a default hue for an unreadable colour", () => {
    const [a] = auroraPalette("not-a-colour", "also-not-a-colour");
    expect(a).toContain(" 262)");
  });
});

/**
 * The way back, which exists because the theme tokens are OKLCH and some APIs
 * only take hex. Handing an `oklch(…)` string to a canvas context returns the
 * same string rather than a hex, so anything relying on that silently gets its
 * fallback — which is how the confetti came out in default blue instead of the
 * company's colour.
 */
describe("oklchToHex", () => {
  it.each(["#14615e", "#2563eb", "#04c604", "#ff6600", "#7c3aed", "#000000", "#ffffff"])(
    "survives the round trip from %s",
    (hex) => {
      const oklch = hexToOklch(hex);
      expect(oklchToHex(oklch!.css)).toBe(hex);
    },
  );

  it("reads a percentage lightness and an explicit degree unit", () => {
    expect(oklchToHex("oklch(54.61% 0.2152 262.88)")).toBe("#2563eb");
    expect(oklchToHex("oklch(0.5461 0.2152 262.88deg)")).toBe("#2563eb");
  });

  it("clamps a colour that sRGB cannot reach instead of producing nonsense", () => {
    const hex = oklchToHex("oklch(0.7 0.4 140)");
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns null for anything that is not an oklch colour", () => {
    expect(oklchToHex("#2563eb")).toBeNull();
    expect(oklchToHex("rebeccapurple")).toBeNull();
    expect(oklchToHex("rgb(1 2 3)")).toBeNull();
    expect(oklchToHex("")).toBeNull();
  });
});
