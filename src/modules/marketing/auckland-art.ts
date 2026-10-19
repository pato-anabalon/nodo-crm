/**
 * The hero's Auckland as data: the painters for each layer and the layers
 * already rasterised to SVG paths. Kept apart from the component that animates
 * them, with no "use client", so the server can draw the same picture too —
 * the image a link to the page unfurls into is this drawing.
 */

import { bell, checker, hash, paint, sprite, wave, type Painter } from "./pixel";

export const W = 320;
export const H = 180;
export const HORIZON = 118;

type Tones = readonly [deep: string, dark: string, mid: string, light: string];

/**
 * Light from the upper left: a round mass is lit on that side and in shadow
 * on the other, with a dither where one tone meets the next and a little
 * noise so it reads as leaves or vapour rather than a flat disc.
 */
function shade(x: number, y: number, dx: number, dy: number, r: number, tones: Tones): string {
  const v = (dy - dx * 0.5) / r;
  const noise = hash(x, y);
  if (v > 0.62) return tones[0];
  if (v > 0.48) return checker(x, y) ? tones[0] : tones[1];
  if (v > 0.12) return noise < 0.08 ? tones[2] : tones[1];
  if (v < -0.62) return tones[3];
  if (v < -0.45) return checker(x, y) ? tones[3] : tones[2];
  return noise < 0.06 ? tones[3] : tones[2];
}

/**
 * Vapour is lit from a point, not along a line: the light falls off in rings
 * around the upper left of each puff, so where one tone meets the next is a
 * curve. Shading it like the leaves drew one straight terminator across every
 * puff of the bank, and the bank read as a sheet folded along a ruler.
 */
function shadeVapour(x: number, y: number, dx: number, dy: number, r: number, tones: Tones): string {
  const lx = dx + 0.35 * r;
  const ly = dy + 0.45 * r;
  const q = Math.sqrt(lx * lx + ly * ly) / r;
  const noise = hash(x, y);
  if (q < 0.55) return noise < 0.05 ? tones[2] : tones[3];
  if (q < 0.7) return checker(x, y) ? tones[3] : tones[2];
  if (q < 1.05) return noise < 0.06 ? tones[3] : tones[2];
  if (q < 1.2) return checker(x, y) ? tones[2] : tones[1];
  if (q < 1.4) return tones[1];
  return checker(x, y) ? tones[1] : tones[0];
}

/**
 * The first circle (front-most) holding the pixel, with a ragged edge. `lumpy`
 * also dents the upper half (dents only, so nothing grows past the box it is painted in): a big circle drawn in pixels has a
 * flat top a dozen pixels wide, which on a cloud reads as a ruled line.
 */
function inBlobs(x: number, y: number, blobs: readonly (readonly [number, number, number])[], lumpy = false) {
  for (const [cx, cy, r] of blobs) {
    const dx = x - cx;
    const dy = y - cy;
    const bump = lumpy && dy < 0 ? -Math.round(0.8 * (wave(x / 6 + cx / 13) + 1)) : 0;
    const edge = (hash(x * 3, y * 5) < 0.35 ? r - 1 : r) + bump;
    if (dx * dx + dy * dy <= edge * edge) return { dx, dy, r };
  }
  return null;
}

// ---------------------------------------------------------------- the sky

const SKY: [number, string][] = [
  [0, "#1d6fd8"],
  [17, "#2a7fe2"],
  [34, "#3a90ea"],
  [51, "#4ea1f0"],
  [68, "#67b4f4"],
  [85, "#86c6f7"],
  [102, "#a7d8fa"],
];

/** Between the words and the tree, where nothing sits in front of it. */
const SUN = [200, 30] as const;

const sky: Painter = (x, y) => {
  if (y >= HORIZON) return null;
  const dx = x - SUN[0];
  const dy = y - SUN[1];
  const d2 = dx * dx + dy * dy;
  if (d2 < 36) return "#fffbe6";
  if (d2 < 90) return "#fff1a8";
  if (d2 < 170 && checker(x, y)) return "#fff1a8";
  let band = 0;
  while (band + 1 < SKY.length && y >= SKY[band + 1][0]) band++;
  const next = SKY[band + 1];
  if (next && y >= next[0] - 2 && checker(x, y)) return next[1];
  return SKY[band][1];
};

// ---------------------------------------------------------------- clouds

const CLOUD_TONES: Tones = ["#b9d8f1", "#d6e9f8", "#f2f9fe", "#ffffff"];

/** The drifting ones: small, a few puffs over a flat base. */
const CLOUD_SHAPES: [number, number, number][][] = [
  [
    [17, 7, 7],
    [9, 10, 5],
    [27, 9, 6],
    [35, 11, 4],
  ],
  [
    [14, 6, 6],
    [7, 9, 4],
    [22, 8, 5],
  ],
  [
    [16, 6, 7],
    [25, 6, 7],
    [8, 9, 5],
    [34, 9, 6],
    [41, 11, 4],
  ],
];

function cloud(circles: [number, number, number][]): Painter {
  const base = Math.max(...circles.map(([, cy, r]) => cy + r)) - 2;
  return (x, y) => {
    if (y > base) return null;
    const hit = inBlobs(x, y, circles, true);
    return hit ? shadeVapour(x, y, hit.dx, hit.dy, hit.r, CLOUD_TONES) : null;
  };
}

export const CLOUDS = [
  {
    paths: paint(cloud(CLOUD_SHAPES[0]), 0, 0, 44, 18),
    y: 12,
    d: 95,
    delay: -10,
  },
  {
    paths: paint(cloud(CLOUD_SHAPES[1]), 0, 0, 30, 14),
    y: 36,
    d: 120,
    delay: -70,
  },
  {
    paths: paint(cloud(CLOUD_SHAPES[2]), 0, 0, 48, 18),
    y: 4,
    d: 140,
    delay: -95,
  },
  {
    paths: paint(cloud(CLOUD_SHAPES[1]), 0, 0, 30, 14),
    y: 52,
    d: 110,
    delay: -30,
  },
];

/** Cumulus banked up behind the city, still: the weather over the gulf. */
const BANK: [number, number, number][] = [
  [178, 96, 14],
  [196, 90, 16],
  [216, 96, 13],
  [160, 102, 11],
  [232, 104, 10],
  [92, 104, 10],
  [108, 98, 12],
  [124, 102, 10],
  [70, 108, 9],
  [140, 106, 9],
  [250, 108, 8],
  [264, 104, 11],
  [282, 108, 9],
];

const bank: Painter = (x, y) => {
  if (y >= HORIZON) return null;
  const hit = inBlobs(x, y, BANK, true);
  if (!hit) return null;
  if (y > 112) return checker(x, y) ? "#b9d8f1" : "#c6e0f4";
  return shadeVapour(x, y, hit.dx, hit.dy, hit.r, CLOUD_TONES);
};

// ---------------------------------------------------------------- far land

const ranges: Painter = (x, y) => {
  if (x > 140 || y >= HORIZON) return null;
  const top = 104 + Math.round(3 * wave(x / 37) + 1.5 * wave(x / 11)) + (x > 118 ? Math.floor((x - 118) / 2) : 0);
  if (y < top) return null;
  if (y === top) return "#98bedb";
  return hash(x, y) < 0.08 ? "#86afd2" : "#7aa6cc";
};

/** Rangitoto: the low, even shield behind the city, as it reads from the west. */
const RANGITOTO = 222;

const rangitoto: Painter = (x, y) => {
  if (y >= HORIZON) return null;
  const top = HORIZON - Math.round(15 * bell((x - RANGITOTO) / 30));
  if (y < top || top > HORIZON - 2) return null;
  if (x >= RANGITOTO - 2 && x <= RANGITOTO + 2 && y === top) return "#4f7699";
  if (x < RANGITOTO && y - top < 2) return "#7aa1c2";
  return hash(x, y) < 0.1 ? "#54799d" : "#5d86ab";
};

// ---------------------------------------------------------------- the harbour

const WATER: [number, string][] = [
  [118, "#4a9de0"],
  [124, "#3a8fd6"],
  [131, "#2f84cc"],
  [140, "#2878c0"],
  [150, "#226cb2"],
];

/** Northcote Point: the headland at the left the bridge sets out from, its trees on the skyline and a seawall at the water. */
const headland = (x: number) => (x <= 6 ? 108 : 108 + Math.ceil(((x - 6) * 10) / 16));

/**
 * The bridge's deck: up off the headland, level over the arch, then down to
 * the city's shore — where it ends, on the land, rather than running on behind it.
 */
const ARCH: [number, number] = [56, 92];
const BRIDGE_END = 111;
function deck(x: number): number {
  if (x < ARCH[0]) return 113 - Math.round((8 * x) / ARCH[0]);
  if (x <= ARCH[1]) return 105;
  return 105 + Math.round(((x - ARCH[1]) * 10) / (BRIDGE_END + 1 - ARCH[1]));
}
/** Piers stand in the water only, between the headland and the shore; the two at the arch's feet are heavier. */
const PIERS: [number, number][] = [
  [22, 1],
  [34, 1],
  [45, 1],
  [ARCH[0] - 1, 2],
  [ARCH[1], 2],
  [102, 1],
];

const bridge: Painter = (x, y) => {
  if (x < 0 || x > BRIDGE_END || y >= HORIZON) return null;
  const land = headland(x);
  if (y >= land) {
    if (y === HORIZON - 1) return "#a9bccb";
    if (y === land) return hash(x, 5) < 0.55 ? "#3f7f45" : "#5c9a52";
    return hash(x, y) < 0.25 ? "#3f7f45" : "#5c9a52";
  }
  if (y === land - 1 && x < 14 && hash(x, 11) < 0.5) return "#3f7f45";
  const d = deck(x);
  if (y === d) return "#5689b3";
  if (y === d + 1) return "#3a6286";
  for (const [px, pw] of PIERS) if (x >= px && x < px + pw && y > d + 1) return pw > 1 ? "#2f5070" : "#35597a";
  if (x >= ARCH[0] && x <= ARCH[1]) {
    const t = (x - ARCH[0]) / (ARCH[1] - ARCH[0]);
    const arch = d - Math.round(30 * t * (1 - t));
    if (y === arch) return "#3f6a8f";
    if ((x - ARCH[0]) % 4 === 0 && y > arch && y < d) return "#5684ab";
  }
  return null;
};

const harbour: Painter = (x, y) => {
  if (y < HORIZON) return null;
  if (x >= 150 && x <= 152 && y < HORIZON + 14 && y % 2 === 0) return "#86bfeb";
  let band = 0;
  while (band + 1 < WATER.length && y >= WATER[band + 1][0]) band++;
  const next = WATER[band + 1];
  if (next && y >= next[0] - 1 && checker(x, y)) return next[1];
  if (hash(x, y) < 0.015) return "#7cbcec";
  return WATER[band][1];
};

export const SHIMMER = [
  [14, 124, 6],
  [40, 130, 4],
  [88, 127, 5],
  [118, 136, 7],
  [212, 123, 5],
  [236, 133, 6],
  [70, 140, 5],
  [180, 129, 4],
] as const;

// ---------------------------------------------------------------- the city

/** `[x, width, height, colour]`, front row first. */
const BUILDINGS: [number, number, number, string][] = [
  [128, 10, 12, "#5e89b0"],
  [144, 9, 15, "#5e89b0"],
  [168, 9, 14, "#5e89b0"],
  [186, 8, 10, "#5e89b0"],
  [124, 8, 22, "#7ea6c8"],
  [133, 7, 30, "#8fb3d2"],
  [139, 6, 18, "#6f98bd"],
  [156, 8, 34, "#8fb3d2"],
  [165, 7, 41, "#7ea6c8"],
  [173, 9, 26, "#6f98bd"],
  [183, 7, 21, "#8fb3d2"],
  [191, 10, 15, "#7ea6c8"],
  [202, 7, 9, "#6f98bd"],
];

const SHORE = 116;

const city: Painter = (x, y) => {
  // The Sky Tower, in front of the city.
  if (y >= 18 && y < SHORE) {
    if (x === 151 && y >= 19 && y <= 42) return y === 19 ? "#ffffff" : "#e3eaf2";
    const podRows: Record<number, [number, number, string]> = {
      43: [148, 154, "#e6edf5"],
      44: [146, 156, "#f4f7fb"],
      45: [146, 156, "#f4f7fb"],
      46: [146, 156, "#7ea6c8"],
      47: [147, 155, "#f4f7fb"],
      48: [148, 154, "#dfe8f1"],
      49: [148, 154, "#c9d6e4"],
      52: [148, 154, "#dfe8f1"],
    };
    const pod = podRows[y];
    if (pod && x >= pod[0] && x <= pod[1]) return pod[2];
    const wide = y >= 106;
    if (y >= 50 && x >= (wide ? 149 : 150) && x <= (wide ? 153 : 152)) {
      return x <= 150 ? "#f4f7fb" : x === 151 ? "#e3eaf2" : "#c5d4e3";
    }
  }
  // The city's shore: a strip of green with trees, and the seawall.
  if (x >= 112 && x <= 214 && y >= SHORE && y < HORIZON) {
    if (y === HORIZON - 1) return "#a9bccb";
    return hash(x, 3) < 0.35 ? "#3f7f45" : "#5c9a52";
  }
  if (x >= 112 && x <= 214 && y === SHORE - 1 && hash(x, 9) < 0.3) return "#3f7f45";
  if (y >= SHORE) return null;
  for (const [bx, bw, bh, colour] of BUILDINGS) {
    if (x >= bx && x < bx + bw && y >= SHORE - bh) {
      const tall = bh > 18;
      if (x === bx && tall) return "#a7c4dd";
      if (tall && (x - bx) % 2 === 1 && (SHORE - y) % 3 === 0 && x < bx + bw - 1) return "#b8d2e8";
      return colour;
    }
  }
  return null;
};

// ---------------------------------------------------------------- yachts

/** A yacht whose spinnaker is `sail`: the mainsail is always white. */
const yacht = (sail: string) =>
  sprite(
    [
      "....w.....",
      "....wr....",
      "...wwr....",
      "...wwrr...",
      "..wwwrr...",
      "..wwwrrr..",
      ".wwwwrrr..",
      "....m.....",
      "nnnnnnnnnn",
      ".nnnnnnnn.",
      "..~~~~~~..",
    ],
    { w: "#ffffff", r: sail, m: "#5a3b2a", n: "#f4f7fb", "~": "#8cc6f2" },
  );

/**
 * Where each yacht starts, the colour of its sail, how long its crossing and
 * the wait after it take, and when its first one begins. Five, with uneven
 * timings, so the harbour never repeats the same order of colours for long.
 */
export const YACHTS = [
  { x: 304, y: 120, sail: "#e2364b", d: 38, delay: -6 },
  { x: 312, y: 123, sail: "#1f6fd8", d: 51, delay: -27 },
  { x: 298, y: 116, sail: "#f5b82e", d: 62, delay: -44 },
  { x: 308, y: 121, sail: "#2fa36b", d: 57, delay: -12 },
  { x: 300, y: 118, sail: "#f07a2a", d: 69, delay: -58 },
].map((boat) => ({ ...boat, paths: paint(yacht(boat.sail), 0, 0, 10, 11) }));

// ---------------------------------------------------------------- the land

const GRASS: Tones = ["#3f8a3a", "#4f9b42", "#5fae4c", "#7cc35f"];
const BUSH: Tones = ["#1f4d27", "#2b6a34", "#3a8443", "#5aa556"];

/** Tī kōuka, cabbage trees: a bare trunk and a burst of leaves at the top. */
const CABBAGE = sprite(
  ["g.g.g.g", ".gGgGg.", "gGGgGGg", ".gGgGg.", "..gGg..", "...t...", "...t...", "...T...", "...t...", "...T...", "...t...", "...t..."],
  { g: "#4c8c3a", G: "#6fae4f", t: "#7a5a3c", T: "#5d4330" },
);

const leftHill = (x: number) => 147 + Math.round(5 * wave(x / 160 + 0.1)) + (x > 150 ? Math.floor((x - 150) / 3) : 0);
/** The North Shore across the water: it rises out of the harbour rather than starting at an edge. */
const rightHill = (x: number) => 137 + Math.round(3 * wave(x / 90)) + (x < 196 ? Math.ceil((196 - x) / 2.2) : 0);
/** The top of whichever hill shows at `x`. */
const hillTop = (x: number) => (x >= 150 ? Math.min(leftHill(x), rightHill(x)) : leftHill(x));

/**
 * Round bush on the hills, `[cx, r]`, and cabbage trees by `x`. Their height
 * comes from the ground under them, so none of them floats over the water:
 * a bush sits half sunk into the slope, a tree's trunk ends just inside it.
 */
const BUSHES: [number, number, number][] = (
  [
    [8, 6],
    [20, 5],
    [96, 5],
    [104, 4],
    [196, 5],
    [206, 6],
    [218, 4],
    [244, 5],
  ] as const
).map(([x, r]) => [x, hillTop(x) + 2, r]);
const CABBAGE_TREES: [number, number][] = [58, 66, 228].map((x) => [x, hillTop(x + 3) - 10]);

const hills: Painter = (x, y) => {
  for (const [tx, ty] of CABBAGE_TREES) {
    const c = CABBAGE(x - tx, y - ty);
    if (c) return c;
  }
  const bush = inBlobs(x, y, BUSHES);
  if (bush) return shade(x, y, bush.dx, bush.dy, bush.r, BUSH);

  const l = leftHill(x);
  if (y >= l && x < 236) {
    if (y === l || (y === l + 1 && checker(x, y))) return GRASS[3];
    const n = hash(x, y);
    if (n < 0.004) return "#fff7d6";
    if (n < 0.1) return GRASS[1];
    return n < 0.18 ? GRASS[3] : GRASS[2];
  }
  const r = rightHill(x);
  if (x >= 150 && y >= r) {
    if (y === r || (y === r + 1 && checker(x, y))) return "#6bb854";
    const n = hash(x, y);
    if (n < 0.004) return "#ffd6e0";
    if (n < 0.1) return GRASS[0];
    return "#4f9b42";
  }
  return null;
};

// ---------------------------------------------------------------- the foreground

const ground = (x: number) => 166 + Math.round(2 * wave(x / 50));

/** Harakeke: blades as sampled curves, and two dark flower stalks. */
const FLAX = (() => {
  const pixels = new Map<string, string>();
  const blades: [number, number, number, number, number, number, string][] = [
    [26, 180, 20, 152, 6, 136, "#3a7d3f"],
    [28, 180, 28, 148, 22, 128, "#2d6b37"],
    [30, 180, 38, 152, 50, 138, "#3a7d3f"],
    [32, 180, 44, 160, 60, 152, "#2d6b37"],
    [24, 180, 14, 164, 2, 158, "#2d6b37"],
    [27, 180, 24, 160, 14, 146, "#4a8f4c"],
  ];
  for (const [x0, y0, cx, cy, x1, y1, colour] of blades) {
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const u = 1 - t;
      const px = Math.round(u * u * x0 + 2 * u * t * cx + t * t * x1);
      const py = Math.round(u * u * y0 + 2 * u * t * cy + t * t * y1);
      const width = t < 0.7 ? 2 : 1;
      for (let k = 0; k < width; k++) pixels.set(`${px + k},${py}`, k === 0 && t < 0.7 ? "#24572d" : colour);
    }
  }
  for (let y = 112; y < 180; y++) pixels.set(`34,${y}`, "#5a3b2a");
  for (const [x, y] of [
    [35, 112],
    [36, 111],
    [33, 118],
    [32, 117],
    [35, 125],
    [36, 124],
  ])
    pixels.set(`${x},${y}`, "#8b1e2d");
  return pixels;
})();

const LEAVES: Tones = ["#1b4723", "#275f30", "#367a3e", "#55a052"];

/** Low scrub along the front edge, so the ground reads as planted rather than mown. */
const SCRUB: [number, number, number][] = [
  [62, 170, 7],
  [74, 168, 6],
  [86, 171, 5],
  [118, 172, 6],
  [130, 170, 5],
  [174, 172, 5],
  [214, 171, 6],
  [226, 169, 7],
  [240, 172, 5],
  [8, 172, 6],
];

/**
 * The pōhutukawa, close enough to stand under: its crown fills the top of the
 * frame at the right, clusters of leaves front to back.
 */
const CROWN: [number, number, number][] = [
  [264, 92, 10],
  [284, 96, 9],
  [310, 94, 10],
  [328, 88, 9],
  [224, 70, 9],
  [242, 74, 12],
  [262, 70, 13],
  [282, 74, 12],
  [302, 74, 13],
  [322, 68, 12],
  [232, 52, 11],
  [250, 48, 13],
  [271, 46, 14],
  [292, 48, 14],
  [314, 46, 13],
  [242, 28, 11],
  [262, 24, 14],
  [284, 22, 14],
  [306, 24, 14],
  [325, 26, 10],
  [256, 6, 10],
  [278, 2, 12],
  [300, 4, 12],
  [320, 6, 9],
];

function nearSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number, r: number): boolean {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  const dx = x - (ax + t * vx);
  const dy = y - (ay + t * vy);
  return dx * dx + dy * dy <= r * r;
}

/** The trunk and its twisting limbs, `[ax, ay, bx, by, radius]`, thinning as they climb. */
const LIMBS: [number, number, number, number, number][] = [
  [290, 182, 287, 156, 8],
  [287, 158, 276, 132, 5],
  [287, 158, 304, 128, 4.2],
  [276, 134, 254, 106, 3.4],
  [276, 134, 282, 100, 3.2],
  [254, 108, 236, 86, 2.4],
  [254, 108, 262, 84, 2],
  [304, 130, 314, 100, 3],
  [282, 102, 274, 76, 2.2],
  [236, 88, 226, 76, 1.5],
];

/** Leaves in clumps: a few pixels a tone darker or lighter, so a mass this size never reads as a disc. */
function foliage(x: number, y: number, dx: number, dy: number, r: number): string {
  const tone = shade(x, y, dx, dy, r, LEAVES);
  const clump = hash(Math.floor(x / 2) + 500, Math.floor(y / 2));
  const index = LEAVES.indexOf(tone);
  if (clump < 0.14 && index > 0) return LEAVES[index - 1];
  if (clump > 0.9 && index < 3 && (dy - dx * 0.5) / r < 0.2) return LEAVES[index + 1];
  return tone;
}

// ---------------------------------------------------------------- the ute and the tradie

/**
 * A white ute parked on the grass under the pōhutukawa, facing away from the
 * city: ladder on the roof rack, a stripe down the side, the tailgate let
 * down. `x` is its back end, `ground` where its tyres sit.
 */
export const UTE = { x: 206, ground: 167, width: 57, height: 23 };

/** The ute at `(u, v)` in its own box: `u` from the tailgate forward, `v` down from the ladder. */
export function ute(u: number, v: number): string | null {
  // The ladder on the roof rack, and the rack's posts under it.
  if (v === 0 && u >= 16 && u <= 52) return "#d7dde3";
  if (v === 1 && u >= 16 && u <= 52) return u % 4 === 0 ? "#d7dde3" : "#8f99a6";
  if (v === 2 && (u === 29 || u === 35 || u === 48)) return "#4a5260";
  // Tyres, hubs, and the dark of the arches over them.
  for (const cx of [14, 45]) {
    const dx = u - cx;
    const dy = v - 18;
    const d2 = dx * dx + dy * dy;
    if (d2 <= 2) return "#c3cbd4";
    if (d2 <= 17) return "#1c1f24";
    if (d2 <= 30 && v >= 13) return "#2a2f36";
  }
  // The tailgate, down: a ledge out the back at the height of the tray floor.
  if (u <= 5 && v === 15) return "#e3e8ee";
  if (u <= 5 && v === 16) return "#aab3bd";
  // The cab's glass, between the roof and the beltline, with its pillars.
  if (u >= 31 && v >= 3 && v <= 8) {
    const screenLine = 49 + Math.floor((v - 3) * 0.8);
    if (u > screenLine) return null;
    if (v === 3) return u >= 33 ? "#f2f4f7" : null;
    if (u <= 32 || u === screenLine || u === 41) return "#eef1f5";
    return v === 4 ? "#c8e6f8" : "#8fc4e8";
  }
  if (v === 9 && u >= 31 && u <= 54) return "#f4f6f9";
  // The body: the tray behind the cab, then the cab and its bonnet.
  if (v >= 10 && v <= 17 && u >= 6 && u <= 56) {
    if (u === 56 && v < 12) return null;
    if (v === 10 && u < 30) return "#dfe4ea";
    if (u === 6 && (v === 11 || v === 12)) return "#e2364b";
    if (u >= 55 && v === 12) return "#ffd84d";
    if (v === 13) return "#1f6fd8";
    if (u === 30 || (u === 42 && v < 17)) return "#cfd6de";
    if (v === 17) return "#aab3bd";
    if (v === 16) return "#d9dee4";
    return "#f4f6f9";
  }
  return null;
}

const utePainter: Painter = (x, y) => {
  const u = x - UTE.x;
  const v = y - (UTE.ground - UTE.height + 1);
  return u >= 0 && u < UTE.width && v >= 0 && v < UTE.height ? ute(u, v) : null;
};

/** Its shadow on the grass, a little to the right of it, away from the sun. */
const inShadow = (x: number, y: number) => x >= UTE.x + 6 && x <= UTE.x + UTE.width + 3 && y >= UTE.ground - 1 && y <= UTE.ground + 1;

/**
 * The tradie, sitting on the tailgate, in profile: facing the city, cap on,
 * hi-vis vest, head down over a phone whose screen lights their hands. A
 * second pose has the arm up — for when a quote comes back accepted.
 */
export const TRADIE_PALETTE = {
  c: "#1f2a44", // cap
  s: "#c98e66", // skin
  h: "#3b2a20", // hair
  t: "#2b3a55", // sleeve
  v: "#ff8a1f", // hi-vis vest
  r: "#e8eef3", // its reflective stripe
  p: "#3a3f4a", // work trousers
  b: "#6b4a2b", // boots
  k: "#c98e66", // hands
  P: "#bfe6ff", // the phone's screen
};

const LEGS = ["....pppppp..", ".ppppppppp..", ".pp.........", ".pp.........", ".pp.........", ".pp.........", "bbb........."];

const SEATED = sprite(
  [
    ".....cccc...",
    "...ccccccc..",
    "....ssshh...",
    "....sssh....",
    ".....ss.....",
    "....tvvvv...",
    "...ttvrvv...",
    "..tt.vrvv...",
    ".kPk.vvvv...",
    ".....vvvv...",
    ...LEGS,
  ],
  TRADIE_PALETTE,
);

const CHEERING = sprite(
  [
    ".P...cccc...",
    ".k.ccccccc..",
    ".s..ssshh...",
    "..s.sssh....",
    "..tt.ss.....",
    "....tvvvv...",
    ".....vrvv...",
    ".....vrvv...",
    ".....vvvv...",
    ".....vvvv...",
    ...LEGS,
  ],
  TRADIE_PALETTE,
);

/** Where the tradie sits: their thighs on the tailgate, legs over its edge. */
export const TRADIE = { x: UTE.x - 3, y: UTE.ground - UTE.height + 1 + 15 - 11 };

export const TRADIE_PATHS = { seated: paint(SEATED, 0, 0, 12, 17), cheering: paint(CHEERING, 0, 0, 12, 17) };

const foreground: Painter = (x, y) => {
  const flax = FLAX.get(`${x},${y}`);
  if (flax) return flax;

  const parked = utePainter(x, y);
  if (parked) return parked;

  // The pōhutukawa's crown, shaded, with its red flowers on the sunlit tops.
  const leaf = inBlobs(x, y, CROWN);
  if (leaf) {
    // Flowers come in tufts of three by three, rounded off at the corners, gathered in patches.
    const lit = (leaf.dy - leaf.dx * 0.5) / leaf.r < 0.15;
    const cx = x % 3;
    const cy = y % 3;
    const patch = hash(Math.floor(x / 9) + 90, Math.floor(y / 9)) < 0.3;
    if (lit && patch && hash(Math.floor(x / 3) * 7, Math.floor(y / 3) * 3) < 0.35 && !(cx !== 1 && cy !== 1)) {
      if (cx === 1 && cy === 1) return "#ff7a8c";
      return hash(x, y) < 0.6 ? "#dd2740" : "#b0182f";
    }
    return foliage(x, y, leaf.dx, leaf.dy, leaf.r);
  }
  for (const [ax, ay, bx, by, r] of LIMBS) {
    if (nearSegment(x, y, ax, ay, bx, by, r)) {
      if (!nearSegment(x - 1, y, ax, ay, bx, by, r)) return "#9a6e49";
      if (!nearSegment(x + 1, y, ax, ay, bx, by, r)) return "#3f2a1a";
      return hash(x, Math.floor(y / 3)) < 0.22 ? "#4a321f" : x > (ax + bx) / 2 ? "#5a3d27" : "#6e4c31";
    }
  }

  const scrub = inBlobs(x, y, SCRUB);
  if (scrub) return shade(x, y, scrub.dx, scrub.dy, scrub.r, BUSH);

  const top = ground(x);
  if (y < top) {
    if (y === top - 1 && hash(x, 7) < 0.3) return "#4fa34a";
    if (y === top - 2 && hash(x, 7) < 0.08) return "#4fa34a";
    return null;
  }
  // The ute's shadow, fallen flowers under the tree, then grass in three greens.
  if (inShadow(x, y)) return checker(x, y) ? "#2e6f2f" : "#356f33";
  if (x > 250 && hash(x, y) < 0.025) return "#dd2740";
  if (y === top && checker(x, y)) return "#4fa34a";
  const n = hash(x * 2, y);
  if (n < 0.004) return "#ffffff";
  if (n < 0.007) return "#ffd84d";
  if (y > 174 && checker(x, y)) return "#367d35";
  return n < 0.2 ? "#468f40" : "#3e8c3c";
};

// ---------------------------------------------------------------- drawing

export const LAYERS = {
  sky: paint(sky, 0, 0, W, HORIZON),
  bank: paint(bank, 50, 70, 300, HORIZON),
  ranges: paint(ranges, 0, 90, 141, HORIZON),
  rangitoto: paint(rangitoto, 120, 96, W, HORIZON),
  harbour: paint(harbour, 0, 60, W, H),
  bridge: paint(bridge, 0, 60, BRIDGE_END + 1, HORIZON),
  city: paint(city, 110, 16, 216, HORIZON),
  hills: paint(hills, 0, 118, W, H),
  foreground: paint(foreground, 0, 0, W, H),
};

