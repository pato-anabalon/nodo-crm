import { contrastRatio, hexToOklch, inkOn, oklchToHex } from "../color";

/** Both card surfaces from `globals.css`. */
const LIGHT = "#ffffff";
const DARK = "#1d283a";

/** Two real ones and the extremes: a pale yellow and a colour already dark. */
const BRANDS = ["#e3410f", "#2563eb", "#facc15", "#0b1f3a"];

const measure = (css: string, surface: string) => {
  const hex = oklchToHex(css);
  expect(hex).not.toBeNull();
  return contrastRatio(hex!, surface)!;
};

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#2563eb", "#2563eb")).toBeCloseTo(1, 5);
  });

  it("agrees with the numbers that sent us looking", () => {
    // PlasterPro's orange on a white card, and the default blue on a dark one:
    // both fine as a button fill, neither readable as an 11px label.
    expect(contrastRatio("#e3410f", LIGHT)!).toBeLessThan(4.5);
    expect(contrastRatio("#2563eb", DARK)!).toBeLessThan(4.5);
  });
});

describe("inkOn", () => {
  it.each(BRANDS)("makes %s readable on the light card", (hex) => {
    const brand = hexToOklch(hex)!;
    expect(measure(inkOn(brand, LIGHT), LIGHT)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(BRANDS)("makes %s readable on the dark card", (hex) => {
    const brand = hexToOklch(hex)!;
    expect(measure(inkOn(brand, DARK), DARK)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the hue and the chroma: it is still the brand", () => {
    const brand = hexToOklch("#e3410f")!;
    const ink = inkOn(brand, LIGHT);

    expect(ink).toContain(` ${brand.c} ${brand.h})`);
  });

  it("darkens on a light ground and lightens on a dark one", () => {
    const brand = hexToOklch("#e3410f")!;
    const lightness = (css: string) => Number(/oklch\(([\d.]+)/.exec(css)![1]);

    expect(lightness(inkOn(brand, LIGHT))).toBeLessThanOrEqual(brand.l);
    expect(lightness(inkOn(brand, DARK))).toBeGreaterThanOrEqual(brand.l);
  });

  it("leaves a colour that already passes exactly where it is", () => {
    // Deliberate: a company whose colour reads fine should see its own colour,
    // not an adjusted one.
    const brand = hexToOklch("#1d4ed8")!;
    expect(contrastRatio("#1d4ed8", LIGHT)!).toBeGreaterThanOrEqual(4.5);
    expect(inkOn(brand, LIGHT)).toBe(brand.css);
  });
});
