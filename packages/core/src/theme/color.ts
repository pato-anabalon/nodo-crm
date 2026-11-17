/**
 * Colour conversion for per-company branding.
 *
 * The theme uses OKLCH (what shadcn generates), but in settings companies pick
 * their colour in hex, which is what any colour picker hands over. The
 * conversion happens here, without libraries, and along the way it decides
 * whether text on that colour should be white or black.
 */

export type BrandColor = {
  /** Value ready for a custom property: `oklch(0.54 0.24 262.9)`. */
  css: string;
  l: number;
  c: number;
  h: number;
  /** Readable text colour on top: white or near-black. */
  readableForeground: string;
};

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim().replace(/^#/, "");
  const expanded =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;

  return {
    r: parseInt(expanded.slice(0, 2), 16) / 255,
    g: parseInt(expanded.slice(2, 4), 16) / 255,
    b: parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

export function hexToOklch(hex: string): BrandColor | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  // Linear sRGB -> LMS (Björn Ottosson's matrix for OKLab).
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.sqrt(okA * okA + okB * okB);
  let hue = (Math.atan2(okB, okA) * 180) / Math.PI;
  if (hue < 0) hue += 360;

  const round = (n: number, digits: number) => Number(n.toFixed(digits));
  const L = round(okL, 4);
  const C = round(chroma, 4);
  const H = round(hue, 2);

  return {
    l: L,
    c: C,
    h: H,
    css: `oklch(${L} ${C} ${H})`,
    // Above roughly 0.62 perceived lightness, white text stops being readable.
    readableForeground: okL > 0.62 ? "oklch(0.15 0 0)" : "oklch(0.99 0 0)",
  };
}

/** The signed distance from `a` to `b` around the wheel, in (-180, 180]. */
function circularHueDiff(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/**
 * The hue that sits between `a` and `b` by the shortest arc.
 *
 * A plain average can take the long way round — orange (35°) and blue
 * (266°) average to 150°, which passes through green on the way, not
 * through anything either colour suggests. The short arc between them goes
 * the other way, through red and magenta, which is what "between orange and
 * blue" actually looks like.
 */
function circularMidpointHue(a: number, b: number): number {
  return (a + circularHueDiff(a, b) / 2 + 360) % 360;
}

/**
 * Three hues for a company's login-screen aurora, built from its own primary
 * and accent colours rather than the fixed trio the generic marketing page
 * uses — "the company's own colours", not a brand-blind default.
 *
 * Only the hue is taken as the brand gave it; lightness and chroma are
 * clamped to a band that reads as a soft, blurred blob. A colour tuned to sit
 * under white on a button isn't automatically a good blob — the same reason
 * `inkOn` doesn't reuse `--primary` as-is for text, aimed at a different end
 * here.
 *
 * The third blob is a blend of the other two, not an invented one: an
 * earlier version rotated the primary by a fixed 150° for it, which for an
 * orange brand landed on teal — a colour nothing in its palette suggested.
 * `circularMidpointHue` is the fix, and also stands in for the accent
 * whenever it's too close to the primary to read as its own colour, which is
 * what keeps the three from collapsing toward one for a company with no
 * accent set.
 */
export function auroraPalette(primaryColor: string, accentColor: string): [string, string, string] {
  const primary = hexToOklch(primaryColor);
  const accent = hexToOklch(accentColor);

  const clampL = (l: number) => Math.min(0.78, Math.max(0.55, l));
  const clampC = (c: number) => Math.min(0.22, Math.max(0.1, c));
  const blob = (hue: number, l: number, c: number) => `oklch(${clampL(l)} ${clampC(c)} ${hue})`;

  const primaryHue = primary?.h ?? 262;
  const primaryL = primary?.l ?? 0.65;
  const primaryC = primary?.c ?? 0.18;

  const distinct = accent !== null && Math.abs(circularHueDiff(primaryHue, accent.h)) > 15;
  const accentHue = distinct ? accent.h : primaryHue + 35;
  const accentL = distinct ? accent.l : primaryL;
  const accentC = distinct ? accent.c : primaryC;

  const midHue = circularMidpointHue(primaryHue, accentHue);

  return [
    blob(primaryHue, primaryL, primaryC),
    blob(accentHue, accentL, accentC),
    blob(midHue, (primaryL + accentL) / 2, (primaryC + accentC) / 2),
  ];
}

/**
 * WCAG 2.1 relative contrast between two sRGB hex colours.
 *
 * 1 is no contrast at all, 21 is black on white. 4.5 is the threshold for text
 * that isn't large.
 */
export function contrastRatio(a: string, b: string): number | null {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  if (first === null || second === null) return null;

  const [light, dark] = first > second ? [first, second] : [second, first];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The company's colour, made readable as text on a given surface.
 *
 * A brand colour is chosen to sit **under** white text on a button, which is a
 * different problem from being text itself: PlasterPro's orange reaches 4.18
 * against a white card, and the default blue only 2.87 against the dark one.
 * Both are fine as a fill and neither passes as an 11px label.
 *
 * So the hue and the chroma are kept — it still reads as the brand — and only
 * the lightness moves, toward the surface's opposite, until the contrast clears
 * `target`. Stepping and measuring rather than computing a lightness directly:
 * OKLCH lightness and WCAG luminance are different models, and the honest way
 * to know whether a colour passes is to convert it and measure.
 *
 * This is the same answer `--status-*-text` gives — colours chosen against the
 * ground they sit on, rather than the fill set lightened.
 */
export function inkOn(
  color: BrandColor,
  surface: string,
  target = 4.5,
): string {
  const surfaceLuminance = relativeLuminance(surface);
  if (surfaceLuminance === null) return color.css;

  // Toward black on a light surface, toward white on a dark one.
  const step = surfaceLuminance > 0.18 ? -0.02 : 0.02;

  for (let l = color.l; l >= 0 && l <= 1; l += step) {
    const candidate = `oklch(${Number(l.toFixed(4))} ${color.c} ${color.h})`;
    const hex = oklchToHex(candidate);
    const ratio = hex ? contrastRatio(hex, surface) : null;
    if (ratio !== null && ratio >= target) return candidate;
  }

  // Nothing at this hue clears the bar: fall back to the end of the ramp rather
  // than to the brand colour, because unreadable is the one outcome to avoid.
  return step < 0 ? `oklch(0 ${color.c} ${color.h})` : `oklch(1 ${color.c} ${color.h})`;
}

function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The way back: an `oklch(…)` string to the hex some APIs insist on.
 *
 * Needed because the theme tokens are OKLCH — `--primary` is whatever
 * `hexToOklch` wrote for the company — while `canvas-confetti` only parses hex.
 * Handing the string to a canvas context does not help: for a CSS Color 4
 * colour the browser gives the same string back rather than an sRGB hex, so
 * anything relying on that silently gets its fallback instead of the brand.
 *
 * Out-of-gamut colours are clamped per channel. That is the ordinary thing to
 * do and it is fine here: these are decorations, not a colour-managed print.
 */
export function oklchToHex(value: string): string | null {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i.exec(
    value.trim(),
  );
  if (!match) return null;

  const okL = match[2] === "%" ? Number(match[1]) / 100 : Number(match[1]);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  if (!Number.isFinite(okL) || !Number.isFinite(chroma) || !Number.isFinite(hue)) return null;

  const okA = chroma * Math.cos(hue);
  const okB = chroma * Math.sin(hue);

  // Exactly the inverse of the matrices in `hexToOklch`, in reverse order.
  const l = (okL + 0.3963377774 * okA + 0.2158037573 * okB) ** 3;
  const m = (okL - 0.1055613458 * okA - 0.0638541728 * okB) ** 3;
  const s = (okL - 0.0894841775 * okA - 1.291485548 * okB) ** 3;

  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return (
    "#" +
    channels
      .map((linear) => {
        const channel = linearToSrgb(linear);
        const byte = Math.round(Math.min(1, Math.max(0, channel)) * 255);
        return byte.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * Math.pow(Math.max(channel, 0), 1 / 2.4) - 0.055;
}
