"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useId } from "react";
import { TRADIE_PALETTE, UTE, ute } from "./auckland-art";
import { checker, hash, paint, sprite, wave, type Painter } from "./pixel";

/**
 * The job the hero's quote won, as pixel art on the same 320 × 180 grid: a
 * house in a suburb across the harbour from the city, the Sky Tower on the
 * skyline, the hero's ute parked on the lawn and its tradie standing by.
 *
 * The house is built in front of you as the section scrolls. It starts as
 * bare sheets behind scaffolding; the render sweeps across it, then the paint,
 * the scaffolding comes down and the garden goes in. Meanwhile the afternoon
 * turns to dusk and then night, and the city's lights, the Sky Tower's pod and
 * the house's own windows come on.
 *
 * `progress` runs from 0 to 1 over the whole story. Decoration only: what each
 * stage means is said in the section's own words.
 */

const W = 320;
const H = 180;

/** Where each change sweeps in, as a share of `progress`. */
export const SWEEP = {
  render: [0.12, 0.3],
  scaffold: [0.34, 0.38], // comes down before the paint goes on
  paint: [0.38, 0.56],
  finish: [0.64, 0.8],
  dusk: [0.3, 0.62],
  night: [0.62, 0.86],
  sunset: [0.62, 0.78], // the sun sinks behind the hills as night comes on
} as const;

// ---------------------------------------------------------------- the sky

const DAY: [number, string][] = [
  [0, "#1d6fd8"],
  [20, "#2a7fe2"],
  [40, "#3a90ea"],
  [60, "#4ea1f0"],
  [80, "#67b4f4"],
  [100, "#86c6f7"],
  [118, "#a7d8fa"],
];

const DUSK: [number, string][] = [
  [0, "#2b3a7a"],
  [20, "#47468f"],
  [40, "#6d4f97"],
  [60, "#9a5a92"],
  [78, "#c96a83"],
  [94, "#e8836f"],
  [108, "#f6a463"],
  [120, "#ffc777"],
];

/** Bands with a dithered seam. */
function skyOf(bands: [number, string][]): Painter {
  return (x, y) => {
    let band = 0;
    while (band + 1 < bands.length && y >= bands[band + 1][0]) band++;
    const next = bands[band + 1];
    if (next && y >= next[0] - 2 && checker(x, y)) return next[1];
    return bands[band][1];
  };
}

const daySky = skyOf(DAY);
const duskSky = skyOf(DUSK);

/** A sun centred on its own origin: a core, a ring, and a dithered halo. */
function sunOf(core: string, ring: string): Painter {
  return (x, y) => {
    const d2 = x * x + y * y;
    if (d2 < 40) return core;
    if (d2 < 100) return ring;
    if (d2 < 180 && checker(x, y)) return ring;
    return null;
  };
}

/**
 * The sun's day: high over the house in the afternoon, across the sky and down
 * to the hills at the left by dusk, then down behind them. It goes behind the
 * land, which is what hides it as it sets.
 */
const SUN = { noon: [292, 26], dusk: [62, 128], set: [56, 152], lift: 22 } as const;

function sunAt(v: number): [number, number] {
  if (v >= SWEEP.sunset[0]) {
    const t = Math.min(1, (v - SWEEP.sunset[0]) / (SWEEP.sunset[1] - SWEEP.sunset[0]));
    return [SUN.dusk[0] + (SUN.set[0] - SUN.dusk[0]) * t, SUN.dusk[1] + (SUN.set[1] - SUN.dusk[1]) * t];
  }
  const t = Math.max(0, v / SWEEP.sunset[0]);
  // Along an arc: a straight line from noon to dusk, lifted most at its middle.
  const x = SUN.noon[0] + (SUN.dusk[0] - SUN.noon[0]) * t;
  const y = SUN.noon[1] + (SUN.dusk[1] - SUN.noon[1]) * t - SUN.lift * 4 * t * (1 - t);
  return [x, y];
}

// ---------------------------------------------------------------- the city across the water

const SKYLINE = 138;
/**
 * `[x, width, height, colour]`, the height measured up from the skyline. Each
 * runs on down behind the neighbours' hedge, so the city stands on its shore
 * rather than ending in a ruled line with the far hills showing under it.
 */
const BUILDINGS: [number, number, number, string][] = [
  [66, 8, 9, "#6f98bd"],
  [75, 6, 15, "#7ea6c8"],
  [82, 9, 22, "#8fb3d2"],
  [92, 7, 13, "#6f98bd"],
  [100, 8, 27, "#7ea6c8"],
  [109, 6, 18, "#8fb3d2"],
  [122, 9, 24, "#8fb3d2"],
  [132, 7, 31, "#7ea6c8"],
  [140, 8, 16, "#6f98bd"],
  [149, 7, 10, "#7ea6c8"],
];

const TOWER = 118;
/** The top of the antenna: a third of the tower's height over the pod reads as the real one does from across the water. */
const SPIRE = 74;
const POD: Record<number, [number, number]> = {
  88: [115, 121],
  89: [114, 122],
  90: [114, 122],
  91: [114, 122],
  92: [115, 121],
  94: [116, 120],
};

/** The tower below its spire: the pod, and the shaft down to the hedge. */
const inTower = (x: number, y: number) => {
  const pod = POD[y];
  if (pod && x >= pod[0] && x <= pod[1]) return true;
  return y >= 95 && y < LAWN && x >= TOWER - 1 && x <= TOWER + 1;
};

const inBuilding = (x: number, y: number) => BUILDINGS.find(([bx, bw, bh]) => x >= bx && x < bx + bw && y >= SKYLINE - bh && y < LAWN);
/** A window: every other column, every third row, on the buildings tall enough to have them. The lights come on in exactly these. */
const isWindow = (x: number, y: number) => {
  const building = inBuilding(x, y);
  if (!building) return false;
  const [bx, bw, bh] = building;
  return bh > 14 && (x - bx) % 2 === 1 && (SKYLINE - y) % 3 === 0 && x < bx + bw - 1;
};

const hillTop = (x: number) => 130 + Math.round(3 * wave(x / 70) + 1.5 * wave(x / 23));
const hedgeTop = (x: number) => 141 + Math.round(2 * wave(x / 23)) + (hash(x, 1) < 0.3 ? 1 : 0);
const LAWN = 150;

/** Where the path from the front door widens as it comes down the lawn. */
const pathAt = (x: number, y: number) => {
  const spread = Math.floor((y - 158) / 3);
  return y >= 158 && x >= 220 - spread && x <= 234 + spread;
};

const land: Painter = (x, y) => {
  // The neighbours' hedge along the back of the section, in front of all of it.
  const hedge = hedgeTop(x);
  if (y >= hedge && y < LAWN) {
    const n = hash(x, y);
    if (y === hedge) return n < 0.5 ? "#3a8443" : "#5aa556";
    return n < 0.2 ? "#1f4d27" : n < 0.75 ? "#2b6a34" : "#3a8443";
  }

  // The Sky Tower, in front of the city.
  if (x === TOWER && y >= SPIRE && y < 88) return y === SPIRE ? "#ffffff" : "#e3eaf2";
  const pod = POD[y];
  if (pod && x >= pod[0] && x <= pod[1]) return y === 90 ? "#7ea6c8" : "#f4f7fb";
  if (y >= 95 && y < LAWN && x >= TOWER - 1 && x <= TOWER + 1) return x === TOWER - 1 ? "#f4f7fb" : x === TOWER ? "#e3eaf2" : "#c5d4e3";

  const building = inBuilding(x, y);
  if (building) {
    const [bx, , bh, colour] = building;
    if (x === bx && bh > 14) return "#a7c4dd";
    return isWindow(x, y) ? "#b8d2e8" : colour;
  }

  // The far shore, blue with distance.
  if (y >= hillTop(x) && y < LAWN) {
    if (y === hillTop(x)) return "#98bedb";
    return hash(x, y) < 0.08 ? "#86afd2" : "#8fb0cc";
  }

  // A cabbage tree at the corner of the section.
  if (x === 306 && y >= 118 && y < 158) return y % 4 === 0 ? "#5d4330" : "#7a5a3c";
  const lx = x - 306;
  const ly = y - 114;
  if (lx * lx + ly * ly <= 40 && hash(x, y) < 0.7 && y < 120) return hash(x * 3, y) < 0.5 ? "#4c8c3a" : "#6fae4f";

  if (y < LAWN) return null;
  // The path to the door, in concrete with its joints.
  if (pathAt(x, y)) return (y - 158) % 6 === 5 ? "#b9b2a5" : hash(x, y) < 0.06 ? "#d8d3c8" : "#cfc9bd";
  // Lawn in three greens, with a lighter fringe along its top.
  if (y === LAWN && checker(x, y)) return "#7cc35f";
  const n = hash(x * 2, y);
  if (n < 0.004) return "#ffffff";
  if (n < 0.1) return "#4f9b42";
  if (y > 172 && checker(x, y)) return "#468f40";
  return n < 0.2 ? "#7cc35f" : "#5fae4c";
};

// ---------------------------------------------------------------- the house

/** Where the house stands: its walls, the eaves and ridge of its hipped roof, its openings. */
const BASE = 158;
const WALL = { left: 162, right: 290, top: 120 };
const ROOF = { top: 96, bottom: 118, ridge: [182, 270], eaves: [154, 298] } as const;
type Box = readonly [x0: number, x1: number, y0: number, y1: number];
const WINDOWS: Box[] = [
  [172, 200, 126, 146],
  [252, 280, 126, 146],
];
const DOOR: Box = [220, 234, 128, 156];
const DOOR_GLASS: Box = [223, 231, 131, 136];

const inBox = (x: number, y: number, [x0, x1, y0, y1]: Box) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const aroundBox = (x: number, y: number, [x0, x1, y0, y1]: Box) =>
  inBox(x, y, [x0 - 1, x1 + 1, y0 - 1, y1 + 1]) && !inBox(x, y, [x0, x1, y0, y1]);

function roof(x: number, y: number): string | null {
  if (y < ROOF.top || y > ROOF.bottom) return null;
  const t = (y - ROOF.top) / (ROOF.bottom - ROOF.top);
  const left = Math.round(ROOF.ridge[0] - (ROOF.ridge[0] - ROOF.eaves[0]) * t);
  const right = Math.round(ROOF.ridge[1] + (ROOF.eaves[1] - ROOF.ridge[1]) * t);
  if (x < left || x > right) return null;
  if (y === ROOF.top) return "#7d8692";
  if (y === ROOF.bottom) return "#3a3f48";
  if (x === left || x === right) return "#454b55";
  // Corrugated iron: a light rib every third pixel.
  return x % 3 === 0 ? "#6b7480" : "#59616d";
}

/** The walls as each stage leaves them: bare sheets, then render, then paint. */
function wall(stage: 0 | 1 | 2, x: number, y: number): string {
  const n = hash(x, y);
  if (stage === 0) {
    if ((x - WALL.left) % 16 === 0 || y === 138 || y === WALL.top) return "#8d98a5";
    return n < 0.04 ? "#b4bdc6" : "#aab4be";
  }
  if (stage === 1) {
    if (y === WALL.top) return "#bdb7a9";
    return n < 0.18 ? "#cdc7b8" : n > 0.88 ? "#e2ded3" : "#d8d3c6";
  }
  if (y === WALL.top) return "#ddd3bd";
  return n < 0.05 ? "#ebe1cb" : "#f4ecda";
}

/** Windows behind protective film and tape, until the paint is on. */
const taped = (x: number, y: number) => ((x + y) % 7 === 0 || (x - y + 70) % 7 === 0 ? "#e6c34d" : "#cfd9e0");
/** The door opening, boarded with ply while the work goes on. */
const ply = (x: number, y: number) => (y % 5 === 0 ? "#b48f58" : hash(x, y) < 0.1 ? "#bf9a62" : "#caa66c");

function glass(x: number, y: number, [x0, x1, y0, y1]: Box): string {
  if (x === Math.round((x0 + x1) / 2)) return "#ffffff";
  const d = x - x0 + (y - y0);
  if (d >= 4 && d <= 6) return "#c4e3f6";
  return y < (y0 + y1) / 2 ? "#8cc2e6" : "#78b0d8";
}

function door(x: number, y: number): string {
  if (inBox(x, y, DOOR_GLASS)) return "#8cc2e6";
  if (x === 231 && y === 143) return "#e6c34d";
  if (aroundBox(x, y, [223, 231, 139, 153])) return "#173d6b";
  return "#1f4f8a";
}

function house(stage: 0 | 1 | 2): Painter {
  return (x, y) => {
    const r = roof(x, y);
    if (r) return r;
    if (y === ROOF.bottom + 1 && x >= ROOF.eaves[0] + 2 && x <= ROOF.eaves[1] - 2) return "#d9dee4";
    if (stage === 2) {
      for (const box of [...WINDOWS, DOOR]) if (aroundBox(x, y, box)) return "#ffffff";
      for (const [x0, x1, , y1] of WINDOWS) if (y === y1 + 2 && x >= x0 - 2 && x <= x1 + 2) return "#d9dee4";
    }
    if (x < WALL.left || x > WALL.right || y < WALL.top || y >= BASE) return null;
    if (y === BASE - 1) return "#7a7f86";
    const window = WINDOWS.find((box) => inBox(x, y, box));
    if (window) return stage < 2 ? taped(x, y) : glass(x, y, window);
    if (inBox(x, y, DOOR)) return stage < 2 ? ply(x, y) : door(x, y);
    return wall(stage, x, y);
  };
}

// ---------------------------------------------------------------- scaffolding and materials

const POLES = [156, 184, 212, 240, 268, 296];
const LIFTS = [116, 136];

const scaffold: Painter = (x, y) => {
  // Plaster bags stacked on the lawn, and a bucket beside them.
  for (const [x0, x1, y0, y1] of [
    [124, 131, 164, 168],
    [133, 140, 164, 168],
    [128, 136, 160, 163],
  ] as Box[]) {
    if (inBox(x, y, [x0, x1, y0, y1])) return y === y1 ? "#c8c0ad" : y === y0 + 2 ? "#1f6fd8" : "#ebe5d6";
  }
  if (inBox(x, y, [143, 147, 163, 168])) return y === 163 ? "#d39a1c" : "#f5b82e";

  if (x < 153 || x > 299 || y < 100 || y > 159) return null;
  for (const pole of POLES) {
    if (y === 159 && x >= pole - 1 && x <= pole + 2) return "#5a6270";
    if (x === pole) return "#b3bbc4";
    if (x === pole + 1) return "#7d8792";
  }
  for (const lift of LIFTS) {
    if (y === lift + 1 || y === lift + 2) return (x - 153) % 20 === 0 ? "#8a6a3e" : y === lift + 1 ? "#c9a46a" : "#a9844f";
    if (y === lift) return "#8f99a6";
  }
  // A brace across every other bay, on both lifts.
  for (let i = 0; i < POLES.length - 1; i += 2) {
    const [a, b] = [POLES[i] + 1, POLES[i + 1]];
    for (const [top, bottom] of [
      [LIFTS[0] + 3, LIFTS[1]],
      [LIFTS[1] + 3, 158],
    ]) {
      if (y < top || y > bottom || x < a || x > b) continue;
      if (Math.abs(x - (a + ((bottom - y) * (b - a)) / (bottom - top))) < 0.7) return "#8f99a6";
    }
  }
  return null;
};

// ---------------------------------------------------------------- the garden

const SHRUBS: [number, number][] = [166, 172, 179, 186, 194, 202, 210, 244, 252, 260, 268, 276, 284].map((x) => [x, 160]);

const garden: Painter = (x, y) => {
  // A red letterbox on its post, at the end of the path.
  if (inBox(x, y, [298, 305, 151, 156])) return y === 151 ? "#b0182f" : x === 298 ? "#b0182f" : "#e2364b";
  if (x >= 301 && x <= 302 && y > 156 && y <= 168) return x === 301 ? "#6b4a2b" : "#4a321f";

  // Shrubs along the front of the house, in flower, over a strip of bark.
  for (const [cx, cy] of SHRUBS) {
    const dx = x - cx;
    const dy = y - cy;
    const r = 3 + (cx % 2);
    if (dy <= 1 && dx * dx + dy * dy <= r * r + (hash(x, y) < 0.3 ? 2 : 0)) {
      const n = hash(x * 5, y * 3);
      if (dy < 0 && n < 0.12) return cx % 3 === 0 ? "#ffd84d" : "#e2364b";
      return dx - dy > 1 ? "#2b6a34" : n < 0.3 ? "#5aa556" : "#3a8443";
    }
  }
  if (y >= 160 && y <= 162 && ((x >= 162 && x <= 216) || (x >= 238 && x <= 290))) return checker(x, y) ? "#5a3d27" : "#6e4c31";
  return null;
};

// ---------------------------------------------------------------- the crew

/** The hero's tradie on their feet in profile, facing the house, phone in hand; and with an arm up when it is done. */
const STANDING = sprite(
  [
    "...cccc...",
    "...ccccccc",
    "...hsss...",
    "...hsss...",
    "....ss....",
    "...vvvvt..",
    "..vvrvvtt.",
    "..vvrvv.kP",
    "..vvvvv...",
    "..vvvvv...",
    "..ppppp...",
    "..pp.pp...",
    "..pp.pp...",
    "..pp.pp...",
    "..pp.pp...",
    "..pp.pp...",
    ".bbb.bbb..",
  ],
  TRADIE_PALETTE,
);

const CHEERING = sprite(
  [
    "...cccc.kP",
    "...ccccccs",
    "...hsss.t.",
    "...hsss.t.",
    "....ss.t..",
    "...vvvvt..",
    "..vvrvv...",
    "..vvrvv...",
    "..vvvvv...",
    "..vvvvv...",
    "..ppppp...",
    "..pp.pp...",
    "..pp.pp...",
    "..pp.pp...",
    "..pp.pp...",
    "..pp.pp...",
    ".bbb.bbb..",
  ],
  TRADIE_PALETTE,
);

/** The ute parked on the lawn facing the house; the tradie between it and the work. */
const PARKED = { x: 24, ground: 168 };
const CREW = { x: 100, y: 152 };

const parked: Painter = (x, y) => {
  const u = x - PARKED.x;
  const v = y - (PARKED.ground - UTE.height + 1);
  if (u >= 0 && u < UTE.width && v >= 0 && v < UTE.height) return ute(u, v);
  // Its shadow on the grass.
  if (x >= PARKED.x + 4 && x <= PARKED.x + UTE.width && y >= PARKED.ground && y <= PARKED.ground + 1)
    return checker(x, y) ? "#2e6f2f" : "#356f33";
  return null;
};

// ---------------------------------------------------------------- after dark

const lights: Painter = (x, y) => {
  // Stars in the dark above the sunset.
  if (y < 70 && hash(x * 7, y * 11) < 0.004) return "#ffffff";
  // The city's windows, some of them lit; never the ones behind the hedge.
  if (y < hedgeTop(x) && !inTower(x, y) && isWindow(x, y) && hash(x, y) < 0.45) return "#ffd27a";
  // The house's windows and the light over its door.
  const window = WINDOWS.find((box) => inBox(x, y, box));
  if (window) return x === Math.round((window[0] + window[1]) / 2) ? "#fff1c2" : y < (window[2] + window[3]) / 2 ? "#ffe3a3" : "#ffd27a";
  if (inBox(x, y, DOOR_GLASS)) return "#ffd27a";
  const dx = x - 238;
  const dy = y - 128;
  if (dx === 0 && dy === 0) return "#fff1c2";
  if (dx * dx + dy * dy <= 8 && checker(x, y)) return "#ffd27a";
  // The ute's lamps: the headlight at the front of the bonnet, the tail light at the tray's back corner.
  const u = x - PARKED.x;
  const v = y - (PARKED.ground - UTE.height + 1);
  if (v === 12 && u >= 55 && u <= 56) return "#fff6d6";
  if (u === 6 && (v === 11 || v === 12)) return "#ff4d5e";
  if (u >= 4 && u <= 5 && (v === 11 || v === 12) && checker(x, y)) return "#b0182f";
  return null;
};

/** The headlight's beam, widening across the lawn towards the house and fading before the tradie. */
const HEADLIGHT = { x: PARKED.x + UTE.width, y: PARKED.ground - UTE.height + 13, reach: 22 };
const beam: Painter = (x, y) => {
  const d = x - HEADLIGHT.x;
  if (d < 0 || d > HEADLIGHT.reach) return null;
  const spread = Math.floor(d / 4);
  if (y < HEADLIGHT.y - spread || y > HEADLIGHT.y + spread) return null;
  // Thinner as it goes: solid near the lamp, a dither further out.
  if (d < 6) return "#ffe9b0";
  return checker(x, y) && hash(x, y) < 1 - d / (HEADLIGHT.reach + 4) ? "#ffe9b0" : null;
};

/**
 * The Sky Tower lit at night, as Auckland lights it: the shape alone, to be
 * filled with a gradient whose colours travel round the wheel. `lit` takes the
 * gradient; `shade` darkens it down the shaft's far side and the pod's band.
 */
const towerLit: Painter = (x, y) => {
  if (!inTower(x, y) || y >= hedgeTop(x)) return null;
  // Shade the shaft's far side only: carried up through the pod as well, it crossed the band and drew a cross.
  return (x === TOWER + 1 && y >= 95) || y === 90 ? "shade" : "lit";
};

// ---------------------------------------------------------------- drawing

const LAYERS = {
  day: paint(daySky, 0, 0, W, 145),
  dusk: paint(duskSky, 0, 0, W, 145),
  sun: paint(sunOf("#fffbe6", "#fff1a8"), -14, -14, 15, 15),
  sunLow: paint(sunOf("#fff1c2", "#ffb35c"), -14, -14, 15, 15),
  land: paint(land, 0, 56, W, H),
  bare: paint(house(0), 150, 94, 300, BASE),
  render: paint(house(1), 150, 94, 300, BASE),
  paint: paint(house(2), 150, 94, 300, BASE),
  scaffold: paint(scaffold, 120, 98, 300, 170),
  garden: paint(garden, 160, 150, 306, 170),
  parked: paint(parked, PARKED.x, PARKED.ground - UTE.height, PARKED.x + UTE.width + 1, PARKED.ground + 2),
  lights: paint(lights, 0, 0, W, SKYLINE + 30),
  tower: paint(towerLit, TOWER - 4, 86, TOWER + 5, LAWN),
  beam: paint(beam, HEADLIGHT.x, HEADLIGHT.y - 6, HEADLIGHT.x + HEADLIGHT.reach + 1, HEADLIGHT.y + 7),
};
const CREW_PATHS = { standing: paint(STANDING, 0, 0, 10, 17), cheering: paint(CHEERING, 0, 0, 10, 17) };

function Paths({ paths }: { paths: [string, string][] }) {
  return (
    <>
      {paths.map(([fill, d]) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </>
  );
}

/** A layer that sweeps in from the left, over what is under it, as `progress` crosses `range`. */
function Sweep({
  id,
  progress,
  range,
  from,
  to,
  children,
}: {
  id: string;
  progress: MotionValue<number>;
  range: readonly [number, number];
  from: number;
  to: number;
  children: React.ReactNode;
}) {
  const width = useTransform(progress, [...range], [from, to]);
  return (
    <>
      <clipPath id={id}>
        <motion.rect x={0} y={0} height={H} width={width} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

export function JobSiteScene({
  progress,
  cheering = false,
  children,
}: {
  progress: MotionValue<number>;
  /** The tradie with an arm in the air: the job is done. */
  cheering?: boolean;
  /** HTML placed over the roof, in the drawing's own pixels (`--u`). */
  children?: React.ReactNode;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const dusk = useTransform(progress, [...SWEEP.dusk], [0, 1]);
  const sunX = useTransform(progress, (v) => Math.round(sunAt(v)[0]));
  const sunY = useTransform(progress, (v) => Math.round(sunAt(v)[1]));
  const night = useTransform(progress, [...SWEEP.night], [0, 1]);
  const dim = useTransform(night, [0, 1], [0, 0.55]);
  const scaffoldOpacity = useTransform(progress, [...SWEEP.scaffold], [1, 0]);

  return (
    // Covers its box the way the hero's drawing does — bottom-aligned, centred,
    // cropped at whichever side is longer. On a phone the crop is centred on
    // the house rather than the drawing.
    <div className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size]" aria-hidden>
      <div className="absolute bottom-0 left-1/2 aspect-[16/9] w-[max(100cqw,177.78cqh)] -translate-x-[66%] md:-translate-x-1/2 [--u:calc(100cqw/320)] [container-type:inline-size]">
        <svg className="ak-scene absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" focusable="false">
          <Paths paths={LAYERS.day} />
          <motion.g style={{ opacity: dusk }}>
            <Paths paths={LAYERS.dusk} />
          </motion.g>
          {/* Whole pixels only, so the sun stays on the drawing's grid as it moves. */}
          <motion.g style={{ x: sunX, y: sunY }}>
            <Paths paths={LAYERS.sun} />
            <motion.g style={{ opacity: dusk }}>
              <Paths paths={LAYERS.sunLow} />
            </motion.g>
          </motion.g>
          <Paths paths={LAYERS.land} />

          <Paths paths={LAYERS.bare} />
          <Sweep id={`${id}render`} progress={progress} range={SWEEP.render} from={150} to={300}>
            <Paths paths={LAYERS.render} />
          </Sweep>
          <Sweep id={`${id}paint`} progress={progress} range={SWEEP.paint} from={150} to={300}>
            <Paths paths={LAYERS.paint} />
          </Sweep>
          <motion.g style={{ opacity: scaffoldOpacity }}>
            <Paths paths={LAYERS.scaffold} />
          </motion.g>
          <Sweep id={`${id}finish`} progress={progress} range={SWEEP.finish} from={160} to={W}>
            <Paths paths={LAYERS.garden} />
          </Sweep>

          <Paths paths={LAYERS.parked} />
          <g transform={`translate(${CREW.x} ${CREW.y})`}>
            <Paths paths={cheering ? CREW_PATHS.cheering : CREW_PATHS.standing} />
          </g>

          {/* Night falls over everything, then the lights come on through it. */}
          <motion.rect x={0} y={0} width={W} height={H} fill="#0a1433" style={{ opacity: dim }} />
          <motion.g style={{ opacity: night }}>
            <Paths paths={LAYERS.lights} />
            <g opacity={0.45}>
              <Paths paths={LAYERS.beam} />
            </g>
            {/* Two stops a half-turn apart, so the tower is always a blend of two colours, never one. */}
            <linearGradient id={`${id}tower`} gradientUnits="userSpaceOnUse" x1={0} y1={86} x2={0} y2={LAWN}>
              <stop offset="0" className="ak-hue" stopColor="#ffd27a" />
              <stop offset="1" className="ak-hue" stopColor="#ff7a3d" style={{ animationDelay: "-5s" }} />
            </linearGradient>
            {LAYERS.tower.map(([kind, d]) => (
              <path key={kind} d={d} fill={kind === "lit" ? `url(#${id}tower)` : "rgba(10, 20, 51, 0.35)"} />
            ))}
            <rect className="ak-beacon" x={TOWER} y={SPIRE - 1} width={1} height={1} fill="#ff4d5e" />
          </motion.g>
        </svg>
        {children && (
          <div
            className="absolute"
            style={{
              left: `calc(var(--u) * ${ROOF.ridge[0] - 8})`,
              bottom: `calc(var(--u) * ${H - ROOF.top + 6})`,
              fontSize: "calc(var(--u) * 2.7)",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
