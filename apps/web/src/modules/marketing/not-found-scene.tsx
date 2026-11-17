import type { CSSProperties } from "react";
import { checker, hash, paint, sprite, type Painter } from "./pixel";

/**
 * The 404 as a building site in Auckland: a tower crane hoisting a "404" board
 * into place on its slings, a smaller crane lifting a crate, cones on the
 * footpath, the Sky Tower behind and a ute going past. It is the landing's own
 * vocabulary — the same rasteriser (`paint`), the same sky and the same rule
 * that nothing moves for somebody who asked for less — so the page a company's
 * customers hit before their site is switched on reads as the same place as the
 * page that sold it to them.
 *
 * Cranes rather than a worker because of scale: the ute is 24 pixels long and a
 * person 16 tall looked like a giant beside it, where a crane is meant to
 * tower over the traffic.
 *
 * A server component: the drawing is rasterised here to a handful of SVG paths
 * and the motion is CSS (`not-found.css`), so the page ships no script at all.
 *
 * Coordinates are in the drawing's own pixels. The scene is 240 wide so a wide
 * screen sees the whole skyline, but everything that matters sits in the middle
 * (`CENTRE`), which is what a phone is left with once the sides are cropped.
 */

const W = 240;
/** 46 rows of city and footpath, then a 20-row road: two lanes tall enough for a ute each. */
const H = 70;
const GROUND = 46;
/** Shifts the props so the middle of what they span (design x 6–146) is the scene's middle. */
const CENTRE = 44;
/** The Sky Tower stands outside the props, clear of the crane's counter-jib. */
const TOWER_X = 196;

const INK = "#1b2a49";
const FACE = "#f7f5ee";
const ORANGE = "#f08a24";
const CRANE = "#f2b705";
const BRACE = "#b88a00";
const STEEL = "#6c727d";
const CABLE = "#3b4150";

// ---------------------------------------------------------------- skyline

/** Far buildings across the whole width, from the hash so every render agrees. */
const BUILDINGS: [x: number, w: number, h: number][] = (() => {
  const out: [number, number, number][] = [];
  let x = 0;
  let i = 0;
  while (x < W) {
    const w = 8 + Math.floor(hash(i, 1) * 10);
    const h = 9 + Math.floor(hash(i, 2) * 22);
    out.push([x, w, h]);
    x += w;
    i++;
  }
  return out;
})();

function buildingAt(x: number): { bx: number; w: number; top: number } | null {
  for (const [bx, w, h] of BUILDINGS) {
    if (x >= bx && x < bx + w) return { bx, w, top: GROUND - h };
  }
  return null;
}

function isWindow(x: number, y: number, b: { bx: number; w: number; top: number }): boolean {
  return (x - b.bx) % 3 === 1 && y % 4 === 1 && y > b.top + 1 && y < GROUND - 2 && x > b.bx && x < b.bx + b.w - 1;
}

const skyline: Painter = (x, y) => {
  const b = buildingAt(x);
  if (!b || y < b.top || y >= GROUND) return null;
  if (isWindow(x, y, b)) return "#2f68b0";
  return x === b.bx ? "#4a8bd6" : "#3b78c4";
};

/** The lit windows, split in two so they twinkle out of step with each other. */
function litWindows(from: number, to: number): Painter {
  return (x, y) => {
    const b = buildingAt(x);
    if (!b || y < b.top || y >= GROUND || !isWindow(x, y, b)) return null;
    const v = hash(x, y);
    return v >= from && v < to ? "#fff1a8" : null;
  };
}

// ---------------------------------------------------------------- the Sky Tower

const TOWER_W = 17;
/** Half the width at each row of the pod, from row 10 down to where it meets the shaft. */
const POD = [2, 4, 6, 6, 6, 4, 2, 1, 1];

const tower: Painter = (x, y) => {
  const d = Math.abs(x - 8);
  let half: number;
  if (y < 2) return null;
  if (y <= 9) half = 0;
  else if (y <= 18) half = POD[y - 10] ?? 0;
  else if (y < 38) half = 1;
  else half = 1 + Math.floor((y - 38) / 2);
  if (d > half) return null;
  if (y === 13 && checker(x, y)) return "#fff1a8";
  if (x < 8) return "#4f79b3";
  return x === 8 ? "#35599a" : "#243f73";
};

// ---------------------------------------------------------------- ground

/**
 * Traffic keeps left in New Zealand, so seen from the footpath the far lane —
 * the upper one — runs left to right and the near, lower one right to left.
 * `top` is the row a vehicle's roof sits on when its wheels are on the lane's
 * lower edge; the centre line is the single row between the two.
 */
const LANES = { centre: 59, upper: 51, lower: 61 } as const;

const ground: Painter = (x, y) => {
  if (y < GROUND) return null;
  if (y === GROUND) return "#e6e0d2";
  if (y < GROUND + 3) return "#cfc8b8";
  if (y === GROUND + 3) return "#8f897c";
  if (y < GROUND + 6) return checker(x, y) ? "#3d4452" : "#353b47";
  // The centre line, between the lanes (see `LANES`).
  if (y === LANES.centre && x % 16 < 8) return "#f2c94c";
  return "#353b47";
};

// ---------------------------------------------------------------- clouds

function cloud(circles: [number, number, number][]): Painter {
  const base = Math.max(...circles.map(([, cy, r]) => cy + r)) - 2;
  return (x, y) => {
    if (y > base) return null;
    for (const [cx, cy, r] of circles) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const v = (dy - dx * 0.5) / r;
      return v > 0.45 ? "#d6e9f8" : v > 0.1 ? "#f2f9fe" : "#ffffff";
    }
    return null;
  };
}

const CLOUDS = [
  { paths: paint(cloud([[8, 8, 5], [15, 6, 6], [22, 8, 5]]), 0, 0, 30, 14), y: 8, x: 30, d: 90, delay: -20 },
  { paths: paint(cloud([[6, 7, 4], [12, 6, 5], [18, 8, 4]]), 0, 0, 24, 13), y: 20, x: 150, d: 120, delay: -75 },
  { paths: paint(cloud([[9, 9, 6], [17, 6, 7], [25, 9, 6], [32, 10, 4]]), 0, 0, 38, 17), y: 2, x: 210, d: 140, delay: -40 },
];

// ---------------------------------------------------------------- the board

const BOARD_W = 56;
const BOARD_H = 24;
const GLYPHS: Record<string, string[]> = {
  "4": ["X.X", "X.X", "XXX", "..X", "..X"],
  "0": ["XXX", "X.X", "X.X", "X.X", "XXX"],
};
const TEXT = "404";

/** An orange-and-white hazard band, then a white face with 404 in 3×3 blocks. */
const board: Painter = (x, y) => {
  if (x === 0 || x === BOARD_W - 1 || y === 0 || y === BOARD_H - 1) return INK;
  if (y < 5) return Math.floor((x + y) / 4) % 2 === 0 ? ORANGE : FACE;

  const dx = x - 11;
  const dy = y - 7;
  if (dx >= 0 && dx < 33 && dy >= 0 && dy < 15) {
    const i = Math.floor(dx / 12);
    const lx = dx - 12 * i;
    const glyph = GLYPHS[TEXT[i] ?? ""];
    if (lx < 9 && glyph?.[Math.floor(dy / 3)]?.[Math.floor(lx / 3)] === "X") return INK;
  }
  return FACE;
};

const CONE = sprite(
  ["...O...", "..OOO..", "..WWW..", ".OOOOO.", ".WWWWW.", "OOOOOOO", "KKKKKKK"],
  { O: "#f26a1b", W: "#ffffff", K: "#2b2f3a" },
);

// ---------------------------------------------------------------- the cranes

/** A lattice mast, 4 wide: two chords with a brace zigzagging between them. */
const mast: Painter = (x, y) => {
  if (x === 0 || x === 3) return CRANE;
  return x === 1 + (Math.floor(y / 3) % 2) ? BRACE : null;
};

/** A jib, 3 high: chords above and below, a brace every third pixel between. */
const jib: Painter = (x, y) => (y === 1 ? (x % 3 === 1 ? BRACE : null) : CRANE);

/** A one-pixel-wide line from one point to another, for the shallow ones: tie rods and slings. */
function line(x0: number, y0: number, x1: number, y1: number, colour: string): Painter {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  return (x, y) => (x >= lo && x <= hi && y === Math.round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)) ? colour : null);
}

function union(...painters: Painter[]): Painter {
  return (x, y) => {
    for (const p of painters) {
      const colour = p(x, y);
      if (colour) return colour;
    }
    return null;
  };
}

/** A sprite's rows turned about, for traffic going the other way. */
const flip = (rows: string[]) => rows.map((row) => [...row].reverse().join(""));

const UTE_ROWS = [
    "..............aa........",
    "............wwwwww......",
    "...........wccccccw.....",
    "wwwwwwwwwwwwwwwwwwwwww..",
    "wwwwwwwwwwwwwwwwwwwwwwl.",
    "oooooooooooooooooooooo..",
    "wwwwwwwwwwwwwwwwwwwwwW..",
    "..kkkk........kkkk......",
    ".kkhhkk......kkhhkk.....",
    "..kkkk........kkkk......",
];
const UTE_PALETTE = { w: "#f5f5f0", W: "#cfd3da", c: "#8ecbf5", k: "#20242c", h: "#8a8f99", l: "#ffd86b", o: "#ff7a1a", a: "#ffb020" };

const SEDAN_ROWS = [
  "......bbbbbb........",
  ".....bccbbccb.......",
  "tbbbbbbbbbbbbbbbbbl.",
  "bbbbbbbbbbbbbbbbbbbb",
  "BBBBBBBBBBBBBBBBBBBB",
  ".kkkk..........kkkk.",
  ".khhk..........khhk.",
  ".kkkk..........kkkk.",
];
const sedanPalette = (body: string, shade: string) => ({
  b: body,
  B: shade,
  c: "#8ecbf5",
  k: "#20242c",
  h: "#8a8f99",
  l: "#ffd86b",
  t: "#e5484d",
});

/**
 * The traffic. A rightward vehicle is drawn as is; a leftward one is flipped,
 * so its headlight leads. They are spread along the road at rest (`x`) and
 * different speeds, so two never keep step with each other.
 */
const CARS = [
  { rows: SEDAN_ROWS, palette: sedanPalette("#d64545", "#a83232"), w: 20, h: 8, top: LANES.upper, dir: "r", x: 60, d: 11, delay: -3 },
  { rows: SEDAN_ROWS, palette: sedanPalette("#f2b705", "#c98f00"), w: 20, h: 8, top: LANES.upper, dir: "r", x: 170, d: 17, delay: -12 },
  { rows: flip(UTE_ROWS), palette: UTE_PALETTE, w: 24, h: 10, top: LANES.lower - 2, dir: "l", x: 90, d: 16, delay: -6 },
  { rows: flip(SEDAN_ROWS), palette: sedanPalette("#2aa6a0", "#1f7f7a"), w: 20, h: 8, top: LANES.lower, dir: "l", x: 200, d: 12, delay: -10 },
].map((car) => ({ ...car, paths: paint(sprite(car.rows, car.palette), 0, 0, car.w, car.h) }));

const BOARD_X = 52;
const BOARD_Y = 20;
/** Where the trolley holds the board: above its middle, under the tower crane's jib. */
const HOOK: [number, number] = [BOARD_X + BOARD_W / 2, 11];

type Paths = [colour: string, d: string][];

function Layer({ paths }: { paths: Paths }) {
  return (
    <>
      {paths.map(([colour, d]) => (
        <path key={colour} d={d} fill={colour} />
      ))}
    </>
  );
}

const PAINTED = {
  skyline: paint(skyline, 0, 0, W, GROUND),
  lit: [paint(litWindows(0, 0.14), 0, 0, W, GROUND), paint(litWindows(0.14, 0.28), 0, 0, W, GROUND)],
  tower: paint(tower, 0, 0, TOWER_W, GROUND),
  ground: paint(ground, 0, GROUND, W, H),
  board: paint(board, 0, 0, BOARD_W, BOARD_H),
  cone: paint(CONE, 0, 0, 7, 7),
  // Tower crane, on the right: 35-high mast, a long jib out over the board.
  bigMast: paint(mast, 0, 0, 4, 35),
  bigJib: paint(jib, 0, 0, 62, 3),
  bigCounterJib: paint(jib, 0, 0, 19, 3),
  bigTies: paint(union(line(125, 2, 62, 8, "#8e949e"), line(126, 2, 146, 8, "#8e949e")), 62, 2, 147, 9),
  // The small one, on the left, lifting a crate.
  smallMast: paint(mast, 0, 0, 4, 24),
  smallJib: paint(jib, 0, 0, 32, 3),
  smallCounterJib: paint(jib, 0, 0, 6, 3),
  smallTies: paint(union(line(15, 14, 46, 19, "#8e949e"), line(16, 14, 8, 19, "#8e949e")), 8, 14, 47, 20),
  // The two slings from the hook down to the board's top corners.
  slings: paint(
    union(line(HOOK[0], 19, BOARD_X + 2, BOARD_Y, CABLE), line(HOOK[0], 19, BOARD_X + BOARD_W - 3, BOARD_Y, CABLE)),
    BOARD_X,
    18,
    BOARD_X + BOARD_W,
    BOARD_Y + 1,
  ),
};

/** The scene, anchored to the foot of whatever holds it and cropped at the sides when narrow. */
export function NotFoundScene({ label }: { label: string }) {
  return (
    <svg
      // Never shorter than the drawing's own proportions (240:70, 29.17% of the
      // width): any less crops the top of it on a wide screen, where a fixed cap
      // once cut the board off. On a phone the floor takes over and the sides crop.
      className="nf-scene block h-[max(200px,29.17vw)] w-full"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      {CLOUDS.map((c) => (
        <g key={c.y} transform={`translate(0 ${c.y})`}>
          <g
            className="nf-cloud"
            style={{ "--x": `${c.x}px`, animationDuration: `${c.d}s`, animationDelay: `${c.delay}s` } as CSSProperties}
          >
            <Layer paths={c.paths} />
          </g>
        </g>
      ))}

      <Layer paths={PAINTED.skyline} />
      {PAINTED.lit.map((paths, i) => (
        <g key={i} className="nf-window" style={{ animationDelay: `${-3.5 * i}s` }}>
          <Layer paths={paths} />
        </g>
      ))}

      <g transform={`translate(${TOWER_X} 0)`}>
        <Layer paths={PAINTED.tower} />
        <rect className="nf-beacon" x="8" y="0" width="1" height="2" fill="#ff4d4d" />
      </g>

      <Layer paths={PAINTED.ground} />

      <g transform={`translate(${CENTRE} 0)`}>
        <g transform="translate(30 39)">
          <Layer paths={PAINTED.cone} />
        </g>
        <g transform="translate(112 39)">
          <Layer paths={PAINTED.cone} />
        </g>

        {/* ---- the small crane, on the left, and the crate it lifts */}
        <rect x="12" y="44" width="8" height="2" fill={STEEL} />
        <g transform="translate(14 22)">
          <Layer paths={PAINTED.smallMast} />
        </g>
        <g transform="translate(8 19)">
          <Layer paths={PAINTED.smallCounterJib} />
        </g>
        <g transform="translate(14 19)">
          <Layer paths={PAINTED.smallJib} />
        </g>
        <rect x="15" y="14" width="2" height="5" fill={CRANE} />
        <Layer paths={PAINTED.smallTies} />
        <rect x="8" y="22" width="4" height="5" fill={STEEL} />
        <rect className="nf-beacon" x="15" y="12" width="2" height="2" fill="#ff4d4d" />
        <rect x="36" y="22" width="4" height="2" fill={CABLE} />
        <g className="nf-lift">
          <rect x="37" y="24" width="1" height="6" fill={CABLE} />
          <rect x="33" y="30" width="9" height="6" fill="#a9743a" />
          <rect x="33" y="30" width="9" height="1" fill="#c98f4f" />
          <rect x="33" y="35" width="9" height="1" fill="#6b4a2f" />
          <rect x="37" y="30" width="1" height="6" fill="#6b4a2f" />
        </g>

        {/* ---- the tower crane, on the right, and the board on its slings */}
        <rect x="122" y="44" width="8" height="2" fill={STEEL} />
        <g transform="translate(124 11)">
          <Layer paths={PAINTED.bigMast} />
        </g>
        <g transform="translate(128 8)">
          <Layer paths={PAINTED.bigCounterJib} />
        </g>
        <g transform="translate(62 8)">
          <Layer paths={PAINTED.bigJib} />
        </g>
        <rect x="125" y="2" width="2" height="6" fill={CRANE} />
        <Layer paths={PAINTED.bigTies} />
        <rect x="140" y="11" width="6" height="6" fill={STEEL} />
        <rect x="119" y="11" width="6" height="5" fill={BRACE} />
        <rect x="119" y="12" width="2" height="2" fill="#8ecbf5" />
        <rect className="nf-beacon" x="125" y="0" width="2" height="2" fill="#ff4d4d" />
        <rect x="78" y="11" width="4" height="2" fill={CABLE} />

        {/* Hangs from the trolley, so it swings about it: the group is moved to
            the hook, turned there, and its contents moved back. */}
        <g transform={`translate(${HOOK[0]} ${HOOK[1]})`}>
          <g className="nf-sway">
            <g transform={`translate(${-HOOK[0]} ${-HOOK[1]})`}>
              <rect x={HOOK[0]} y="13" width="1" height="6" fill={CABLE} />
              <Layer paths={PAINTED.slings} />
              <g transform={`translate(${BOARD_X} ${BOARD_Y})`}>
                <Layer paths={PAINTED.board} />
              </g>
              {/* The lamps on top take turns, as they do on a real barrier. */}
              <rect x={BOARD_X + 2} y={BOARD_Y - 3} width="4" height="2" fill="#ffb020" className="nf-blink" />
              <rect x={BOARD_X + BOARD_W - 6} y={BOARD_Y - 3} width="4" height="2" fill="#ffb020" className="nf-blink nf-blink-b" />
              <rect x={BOARD_X + 3} y={BOARD_Y - 1} width="2" height="1" fill="#8e949e" />
              <rect x={BOARD_X + BOARD_W - 5} y={BOARD_Y - 1} width="2" height="1" fill="#8e949e" />
            </g>
          </g>
        </g>
      </g>

      {CARS.map((car) => (
        <g key={`${car.dir}${car.x}`} transform={`translate(0 ${car.top})`}>
          <g
            className={`nf-car nf-car-${car.dir}`}
            style={{ "--x": `${car.x}px`, animationDuration: `${car.d}s`, animationDelay: `${car.delay}s` } as CSSProperties}
          >
            <Layer paths={car.paths} />
          </g>
        </g>
      ))}
    </svg>
  );
}
