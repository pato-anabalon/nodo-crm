import { hexToOklch, inkOn, type BrandColor } from "@nodo/core/theme/color";
import { colorValue, type ColorName, type Scheme } from "./colors";
import { toHex } from "./hex";

/**
 * The company's colour over the tokens, for both apps: the web writes these
 * into a `<style>` (`BrandTheme`), the app hands them to NativeWind's `vars()`
 * at the root — as hex there, because React Native has no OKLCH.
 *
 * `brand-ink` is the colour as *text*, which is not the same colour. The brand
 * is picked to sit under white on a button; the same value as an 11px label
 * on a card can land under 4.5:1 — PlasterPro's orange does on white, the
 * default blue does on the dark card. `inkOn` keeps the hue and moves only the
 * lightness until it clears the bar, against each scheme's card separately: a
 * dark theme is not the light one inverted.
 *
 * Only `brand-ink` differs between schemes; the fill is the company's in both.
 */
export type BrandVars = Record<Scheme, Partial<Record<ColorName, string>>>;

export function brandVars(primaryColor: string, accentColor: string | null, format: "css" | "hex" = "css"): BrandVars | null {
  const primary = hexToOklch(primaryColor);
  if (!primary) return null;
  const accent = accentColor ? hexToOklch(accentColor) : null;
  const out = (value: string) => (format === "hex" ? toHex(value) : value);

  const fill: Partial<Record<ColorName, string>> = {
    primary: out(primary.css),
    "primary-foreground": out(primary.readableForeground),
    ring: out(primary.css),
    "sidebar-primary": out(primary.css),
    "sidebar-primary-foreground": out(primary.readableForeground),
    ...(accent ? { "chart-1": out(accent.css) } : {}),
  };

  return {
    light: { ...fill, "brand-ink": out(ink(primary, "light")) },
    dark: { ...fill, "brand-ink": out(ink(primary, "dark")) },
  };
}

/** What brand text sits on: the card, in that scheme. */
export const cardHex = (scheme: Scheme) => toHex(colorValue("card", scheme));

const ink = (primary: BrandColor, scheme: Scheme) => inkOn(primary, cardHex(scheme));
