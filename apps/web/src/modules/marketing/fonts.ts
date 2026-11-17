import { Geist_Pixel } from "next/font/google";

/**
 * The hero's notices are part of its pixel drawing, so they speak in pixels too —
 * in Geist's own pixel cut, the same letters as the rest of the app, and one
 * whose e, 2 and 5 read as themselves at the size a notice is set.
 *
 * No metric-matched fallback: Next has no metrics on file for this family and
 * says so on every compile. A notice is one short line in a fixed-width card,
 * so a monospace stand-in reflowing for a moment costs nothing.
 */
export const pixelFont = Geist_Pixel({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});
