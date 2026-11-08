import { COLORS, colorValue, type ColorName, type Scheme } from "./colors";
import { toHex } from "./hex";
import { LAYOUT, RADII } from "./shape";
import { TYPE_SCALE, type TypeRoleName } from "./typography";
import type { BrandVars } from "./brand";

/**
 * The app's half. Colours travel as CSS variables, the way the web's do, so
 * the company's colour lands by replacing variables at the root rather than by
 * restyling anything: `colorVars(scheme, brand)` goes to NativeWind's `vars()`,
 * and `nativeTheme` is the Tailwind theme whose colours point at them.
 */

const NAMES = Object.keys(COLORS) as ColorName[];

/** Every colour of a scheme as hex, `var(--x)` references resolved. */
export function palette(scheme: Scheme): Record<ColorName, string> {
  const resolve = (name: ColorName, seen: ColorName[] = []): string => {
    const value = colorValue(name, scheme);
    const ref = /^var\(--([\w-]+)\)$/.exec(value)?.[1] as ColorName | undefined;
    if (!ref) return toHex(value);
    if (seen.includes(ref) || !(ref in COLORS)) throw new Error(`Unresolvable colour reference: ${name} → ${ref}`);
    return resolve(ref, [...seen, name]);
  };
  return Object.fromEntries(NAMES.map((name) => [name, resolve(name)])) as Record<ColorName, string>;
}

/** For `vars()` at the app's root: the scheme's palette with the company's colour over it (`brandVars(…, "hex")`). */
export function colorVars(scheme: Scheme, brand?: BrandVars | null): Record<`--${string}`, string> {
  const colors = { ...palette(scheme), ...brand?.[scheme] };
  return Object.fromEntries(Object.entries(colors).map(([name, hex]) => [`--${name}`, hex]));
}

/**
 * A role as a React Native text style, for what NativeWind's classes don't
 * reach (an animated text, a chart label). Tracking is in points there, not em.
 */
export function textStyle(role: TypeRoleName) {
  const r = TYPE_SCALE[role] as (typeof TYPE_SCALE)[TypeRoleName] & { weight?: number; uppercase?: true; tabular?: true };
  return {
    fontSize: r.size,
    lineHeight: r.leading,
    letterSpacing: round(r.tracking * r.size),
    ...(r.weight ? { fontWeight: String(r.weight) as `${number}` } : {}),
    ...(r.uppercase ? { textTransform: "uppercase" as const } : {}),
    ...(r.tabular ? { fontVariant: ["tabular-nums" as const] } : {}),
  };
}

/**
 * The Tailwind theme the app's NativeWind config extends: `bg-card`,
 * `text-callout`, `rounded-xl`, `p-gutter` mean what they mean on the web.
 * The app's font is the system's (SF Pro, Roboto), so there is no family here.
 */
export const nativeTheme = {
  colors: Object.fromEntries(NAMES.map((name) => [name, `var(--${name})`])),
  fontSize: Object.fromEntries(
    (Object.keys(TYPE_SCALE) as TypeRoleName[]).map((role) => {
      const style = textStyle(role);
      return [
        role,
        [
          `${style.fontSize}px`,
          {
            lineHeight: `${style.lineHeight}px`,
            letterSpacing: `${style.letterSpacing}px`,
            ...("fontWeight" in style ? { fontWeight: style.fontWeight } : {}),
          },
        ],
      ];
    }),
  ),
  borderRadius: Object.fromEntries(Object.entries(RADII).map(([name, px]) => [name, `${px}px`])),
  spacing: {
    gutter: `${LAYOUT.gutter}px`,
    "card-pad": `${LAYOUT.cardPad.app}px`,
    stack: `${LAYOUT.stack}px`,
    "stack-loose": `${LAYOUT.stackLoose}px`,
    section: `${LAYOUT.section}px`,
  },
};

function round(n: number): number {
  return Number(n.toFixed(3));
}
