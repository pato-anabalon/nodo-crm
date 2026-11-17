/**
 * A tiny pixel-art rasteriser for the hero. A layer is a function from a
 * pixel to a colour (or nothing); `paint` walks its box and merges runs of the
 * same colour into one SVG path per colour, so a whole layer is a handful of
 * DOM nodes however many pixels it has.
 *
 * Everything here uses arithmetic only — no `Math.sin`, `Math.exp` or
 * `Math.random`. The page is rendered on the server and hydrated in the
 * browser, and the transcendental functions are allowed to differ in their
 * last bit between engines: one pixel rounding the other way would be a
 * hydration mismatch. `+`, `*`, `/`, `floor` and `sqrt` are exact everywhere.
 */

export type Colour = string | null;
export type Painter = (x: number, y: number) => Colour;

/** One path per colour, made of the horizontal runs of that colour. */
export function paint(painter: Painter, x0: number, y0: number, x1: number, y1: number): [string, string][] {
  const paths = new Map<string, string[]>();
  for (let y = y0; y < y1; y++) {
    let runColour: Colour = null;
    let runStart = x0;
    for (let x = x0; x <= x1; x++) {
      const colour = x < x1 ? painter(x, y) : null;
      if (colour === runColour) continue;
      if (runColour) {
        const list = paths.get(runColour) ?? [];
        list.push(`M${runStart} ${y}h${x - runStart}v1h${runStart - x}z`);
        paths.set(runColour, list);
      }
      runColour = colour;
      runStart = x;
    }
  }
  return [...paths].map(([colour, parts]) => [colour, parts.join("")]);
}

/** A sine-like wave with period 1 and range [-1, 1], from parabolas. */
export function wave(t: number): number {
  const p = t - Math.floor(t);
  return p < 0.5 ? 1 - 16 * (p - 0.25) * (p - 0.25) : -(1 - 16 * (p - 0.75) * (p - 0.75));
}

/** A bell with its peak of 1 at 0, falling to about 0.25 at ±1. */
export function bell(u: number): number {
  const d = 1 + u * u;
  return 1 / (d * d);
}

/** A stable pseudo-random value in [0, 1) for a pixel. */
export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Whether two pixels share a checkerboard square — the dither between bands. */
export function checker(x: number, y: number): boolean {
  return (x + y) % 2 === 0;
}

/** A sprite from rows of characters, each mapped to a colour ("." is empty). */
export function sprite(rows: string[], palette: Record<string, string>): Painter {
  return (x, y) => {
    const ch = rows[y]?.[x];
    return ch && ch !== "." ? (palette[ch] ?? null) : null;
  };
}
