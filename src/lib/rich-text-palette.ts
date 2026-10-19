/**
 * The colours the full editor offers, and the only ones the sanitiser lets
 * through. One list read on both sides: the toolbar draws its swatches from
 * it, and `sanitizeRichText(html, "full")` builds its allow-list from it — so
 * a hand-crafted post can't paint text a colour nobody could pick.
 *
 * Text colours are mid-tones that read on the white card and on the dark one.
 * Highlights are pale grounds; the text on them is held dark by the
 * stylesheet in both themes, since a pale yellow behind light text is
 * unreadable.
 */
export const TEXT_COLORS = [
  { key: "red", value: "#c92a2a" },
  { key: "orange", value: "#d9480f" },
  { key: "yellow", value: "#b08800" },
  { key: "green", value: "#2b8a3e" },
  { key: "blue", value: "#1971c2" },
  { key: "purple", value: "#7048e8" },
  { key: "gray", value: "#868e96" },
] as const;

export const HIGHLIGHT_COLORS = [
  { key: "yellow", value: "#fff3bf" },
  { key: "green", value: "#d3f9d8" },
  { key: "blue", value: "#d0ebff" },
  { key: "pink", value: "#ffdeeb" },
  { key: "orange", value: "#ffe8cc" },
  { key: "gray", value: "#e9ecef" },
] as const;

/**
 * A colour as the editor may write it back. Typed in as hex, but a browser
 * reading the style off the page reports `rgb(…)` — which is what an edited
 * post comes back with — so both spellings of the same colour count.
 */
export function colorPattern(values: readonly string[]): RegExp {
  const alternatives = values.flatMap((hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return [hex, `rgb\\(\\s*${r},\\s*${g},\\s*${b}\\s*\\)`];
  });
  return new RegExp(`^(?:${alternatives.join("|")})$`, "i");
}
