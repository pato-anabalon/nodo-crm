import { oklchToHex } from "@nodo/core/theme/color";

/**
 * A token's value as the hex React Native understands: `#rrggbb`, or
 * `#rrggbbaa` when it carries an alpha (`oklch(1 0 0 / 10%)`, the dark
 * hairline). Hex passes through. A `var(--x)` is resolved by the caller, which
 * knows the palette it belongs to.
 */
export function toHex(value: string): string {
  if (value.startsWith("#")) return value.toLowerCase();

  const match = /^oklch\((.+?)\s*\/\s*([\d.]+)(%?)\s*\)$/i.exec(value.trim());
  const opaque = match ? `oklch(${match[1]})` : value;
  const hex = oklchToHex(opaque);
  if (!hex) throw new Error(`Not a colour this package can convert: ${value}`);
  if (!match) return hex;

  const alpha = match[3] === "%" ? Number(match[2]) / 100 : Number(match[2]);
  return hex + Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, "0");
}
