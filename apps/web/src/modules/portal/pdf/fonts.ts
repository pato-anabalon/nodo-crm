import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Geist, embedded, for the quote PDF.
 *
 * The base-14 PDF fonts (Helvetica and friends) aren't embedded — a PDF that
 * names "Helvetica" is trusting whichever viewer opens it to supply something
 * close enough, usually Arial. Close isn't identical: Arial's line metrics
 * drift from the ones PDFKit laid the page out against, and a two-line title
 * came out overlapping the field below it. Shipping the real font file is
 * what makes the metrics React PDF measured with the ones a reader actually
 * sees — and it's the same Geist the rest of the app already uses, so a
 * company's own quote reads in the same face as their dashboard.
 *
 * The four files are checked in rather than fetched from Google Fonts at
 * render time: one less network call on the one thing this rewrite was for
 * — a PDF that comes back fast.
 */
const FONT_DIR = path.join(process.cwd(), "src/assets/fonts/geist");

let registered = false;

export function ensureFontsRegistered(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Geist",
    fonts: [
      { src: path.join(FONT_DIR, "Geist-Regular.ttf"), fontWeight: "normal", fontStyle: "normal" },
      { src: path.join(FONT_DIR, "Geist-Bold.ttf"), fontWeight: "bold", fontStyle: "normal" },
      { src: path.join(FONT_DIR, "Geist-Italic.ttf"), fontWeight: "normal", fontStyle: "italic" },
      { src: path.join(FONT_DIR, "Geist-BoldItalic.ttf"), fontWeight: "bold", fontStyle: "italic" },
    ],
  });

  // Geist has no hyphenation dictionary of its own, and the default callback
  // guesses syllable breaks that don't exist in it — visible as a stray
  // hyphen mid-word on a long company name. Returning the word whole disables
  // hyphenation rather than mis-hyphenating.
  Font.registerHyphenationCallback((word) => [word]);
}
