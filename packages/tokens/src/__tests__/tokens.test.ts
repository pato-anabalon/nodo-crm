import { hexToOklch, inkOn } from "@nodo/core/theme/color";
import { brandVars, cardHex } from "../brand";
import { COLORS } from "../colors";
import { tokensCss } from "../css";
import { toHex } from "../hex";
import { motionSpring, projectMomentum, reanimatedSpring, springPhysics, SPRINGS } from "../motion";
import { colorVars, nativeTheme, palette, textStyle } from "../native";
import { nestedRadius } from "../shape";

describe("hex for React Native", () => {
  it("converts OKLCH, keeps an alpha, and passes hex through", () => {
    expect(toHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(toHex("oklch(1 0 0 / 10%)")).toBe("#ffffff1a");
    expect(toHex("#F2F2F2")).toBe("#f2f2f2");
    expect(() => toHex("rebeccapurple")).toThrow();
  });

  it("resolves every colour of both schemes, references included", () => {
    for (const scheme of ["light", "dark"] as const) {
      const colors = palette(scheme);
      expect(Object.keys(colors)).toEqual(Object.keys(COLORS));
      for (const hex of Object.values(colors)) expect(hex).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
      expect(colors["brand-ink"]).toBe(colors.primary);
    }
  });
});

describe("the web's stylesheet", () => {
  const css = tokensCss();
  const block = (selector: string) => css.slice(css.indexOf(`${selector} {`), css.indexOf("}", css.indexOf(`${selector} {`)));

  it("says in dark only what differs", () => {
    expect(block(".dark")).toContain("--panel: oklch(0.178 0 0);");
    expect(block(".dark")).not.toContain("--status-sent:");
    expect(block(":root")).toContain("--status-sent: #1d4ed8;");
  });

  it("writes each role as one class's four properties", () => {
    expect(block("@theme inline")).toContain("--text-callout: 0.875rem;");
    expect(block("@theme inline")).toContain("--text-callout--line-height: 1.25rem;");
    expect(block("@theme inline")).toContain("--text-title-2--letter-spacing: -0.016em;");
    expect(block("@theme inline")).toContain("--text-title-2--font-weight: 700;");
    expect(block("@theme inline")).not.toContain("--text-callout--font-weight");
  });

  it("registers utilities only for the tokens that had them, and leaves Tailwind's xs and 2xl radii alone", () => {
    const theme = block("@theme inline");
    expect(theme).toContain("--color-panel: var(--panel);");
    expect(theme).not.toContain("--color-status-sent");
    expect(theme).toContain("--radius-xl: 0.875rem;");
    expect(theme).not.toMatch(/--radius-(xs|2xl):/);
  });
});

describe("the company's colour", () => {
  it("works the ink out against each scheme's real card", () => {
    expect(cardHex("light")).toBe("#ffffff");
    expect(cardHex("dark")).toBe("#171717");

    const orange = hexToOklch("#f97316")!;
    const vars = brandVars("#f97316", null)!;
    expect(vars.light["brand-ink"]).toBe(inkOn(orange, "#ffffff"));
    expect(vars.dark["brand-ink"]).toBe(inkOn(orange, "#171717"));
    expect(vars.light.primary).toBe(orange.css);
    expect(vars.light["chart-1"]).toBeUndefined();
  });

  it("comes as hex for the app, over the scheme's palette", () => {
    const vars = colorVars("dark", brandVars("#f97316", "#0ea5e9", "hex"));
    expect(vars["--primary"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars["--chart-1"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars["--panel"]).toBe(palette("dark").panel);
  });

  it("refuses what isn't a colour", () => {
    expect(brandVars("orange", null)).toBeNull();
  });
});

describe("the app's theme", () => {
  it("points its colours at the variables", () => {
    expect(nativeTheme.colors.card).toBe("var(--card)");
  });

  it("writes tracking in points, since React Native has no em", () => {
    expect(textStyle("display")).toEqual({ fontSize: 34, lineHeight: 40, letterSpacing: -0.748, fontWeight: "700" });
    expect(textStyle("label")).toMatchObject({ letterSpacing: 0.66, textTransform: "uppercase" });
    expect(textStyle("numeric-xl").fontVariant).toEqual(["tabular-nums"]);
    expect(nativeTheme.fontSize.body).toEqual(["16px", { lineHeight: "24px", letterSpacing: "-0.08px" }]);
  });

  it("nests radii concentrically, never below the smallest", () => {
    expect(nestedRadius(20, 8)).toBe(12);
    expect(nestedRadius(10, 8)).toBe(4);
  });
});

describe("springs", () => {
  it("convert to the same physics in every library", () => {
    const { stiffness, damping } = springPhysics(SPRINGS.default);
    expect(stiffness).toBeCloseTo((2 * Math.PI / 0.35) ** 2);
    // Critically damped: damping² = 4·mass·stiffness.
    expect(damping ** 2).toBeCloseTo(4 * stiffness);
    expect(motionSpring(SPRINGS.momentum)).toEqual({ type: "spring", bounce: expect.closeTo(0.2), visualDuration: 0.35 });
    expect(reanimatedSpring(SPRINGS.sheet)).toEqual({ dampingRatio: 1, duration: 300 });
  });

  it("project a flick forward the way scrolling decelerates", () => {
    expect(projectMomentum(1000)).toBeCloseTo(499);
    expect(projectMomentum(-1000)).toBeCloseTo(-499);
    expect(projectMomentum(0)).toBe(0);
  });
});
