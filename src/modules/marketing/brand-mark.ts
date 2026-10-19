import { checker, paint, type Painter } from "./pixel";

/**
 * Nodo CRM's mark, in the landing's own pixels: the Sky Tower on a 32 × 32
 * grid, white against the hero's afternoon sky, the sun beside it and the
 * green of the hills at its foot. It is the page's drawing cut down to the one
 * thing that still reads at the size of a browser tab.
 */

export const MARK_SIZE = 32;

const SKY: [number, string][] = [
  [0, "#1d6fd8"],
  [6, "#2a7fe2"],
  [12, "#3a90ea"],
  [18, "#4ea1f0"],
  [22, "#67b4f4"],
];

/** Pixel-rounded corners, so the tile reads as an app icon rather than a cut square. */
const RADIUS = 6;
function inTile(x: number, y: number): boolean {
  const cx = x < RADIUS ? RADIUS - 0.5 : x >= MARK_SIZE - RADIUS ? MARK_SIZE - RADIUS - 0.5 : x;
  const cy = y < RADIUS ? RADIUS - 0.5 : y >= MARK_SIZE - RADIUS ? MARK_SIZE - RADIUS - 0.5 : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

const TOWER = 14;
const POD: Record<number, [number, number, string]> = {
  9: [12, 16, "#f4f7fb"],
  10: [11, 17, "#ffffff"],
  11: [11, 17, "#7ea6c8"],
  12: [12, 16, "#e3eaf2"],
};

const mark: Painter = (x, y) => {
  if (!inTile(x, y)) return null;

  // The tower: red light at the tip, the spire, the pod, the shaft widening at its foot.
  if (x === TOWER && y === 2) return "#ff4d5e";
  if (x === TOWER && y >= 3 && y <= 8) return "#ffffff";
  const pod = POD[y];
  if (pod && x >= pod[0] && x <= pod[1]) return pod[2];
  const foot = y >= 24 ? 2 : 1;
  if (y >= 13 && y <= 26 && x >= TOWER - foot && x <= TOWER + foot) {
    return x < TOWER ? "#ffffff" : x === TOWER ? "#e3eaf2" : "#c5d4e3";
  }

  // The hills, lit along their tops.
  const hill = 25 + (x < 10 ? Math.floor((10 - x) / 4) * -1 : 0) + (x > 22 ? -1 : 0);
  if (y >= hill) {
    if (y === hill) return "#7cc35f";
    return (x + y) % 5 === 0 ? "#4f9b42" : "#5fae4c";
  }

  // The sun, to the right of the tower.
  const sx = x - 24;
  const sy = y - 8;
  const d2 = sx * sx + sy * sy;
  if (d2 <= 4) return "#fffbe6";
  if (d2 <= 9) return "#fff1a8";

  let band = 0;
  while (band + 1 < SKY.length && y >= SKY[band + 1][0]) band++;
  const next = SKY[band + 1];
  if (next && y === next[0] - 1 && checker(x, y)) return next[1];
  return SKY[band][1];
};

/** The mark as an SVG document, ready to be a data URI. */
export function markSvg(): string {
  const paths = paint(mark, 0, 0, MARK_SIZE, MARK_SIZE)
    .map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}" shape-rendering="crispEdges">${paths}</svg>`;
}

/** Any SVG string as a data URI, for an `<img>` inside `ImageResponse`. */
export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
