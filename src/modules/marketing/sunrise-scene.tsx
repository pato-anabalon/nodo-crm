"use client";

import { motion, useInView, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TRADIE_PALETTE, UTE, ute } from "./auckland-art";
import { pixelFont } from "./fonts";
import { bell, checker, hash, paint, type Painter } from "./pixel";

/**
 * The morning after, to close the page: the Waitematā at first light from the
 * waterfront road, the city and the Sky Tower against the sky at the left,
 * Rangitoto at the right with the sun coming up behind it, and the hero's ute
 * driving along the road to the next job.
 *
 * `progress` runs from 0 to 1 as the page reaches its end: the sky goes from
 * the last of the night to dawn, the stars and the city's lights go out, and
 * the sun climbs out of the sea. Every minute the Sky Tower lets off a few
 * fireworks — the job is done, after all. Decoration only.
 */

const W = 320;
const H = 180;
const HORIZON = 120;
const SEA = 148;

// ---------------------------------------------------------------- sky and sea

type Bands = [number, string][];

const NIGHT_SKY: Bands = [
  [0, "#0d1538"],
  [24, "#17204a"],
  [48, "#26295c"],
  [72, "#3d3168"],
  [92, "#5b3a6e"],
  [108, "#7a4570"],
];
const NIGHT_SEA: Bands = [
  [HORIZON, "#2a2a5a"],
  [128, "#222552"],
  [138, "#1b2049"],
];
const DAWN_SKY: Bands = [
  [0, "#3a4f9a"],
  [22, "#5f63b0"],
  [44, "#9a6fb4"],
  [64, "#d77fa2"],
  [82, "#f39a86"],
  [98, "#ffbe7a"],
  [110, "#ffd98f"],
];
const DAWN_SEA: Bands = [
  [HORIZON, "#c98aa0"],
  [126, "#8f74a8"],
  [134, "#6a65a0"],
  [142, "#525a94"],
];

function band(bands: Bands, x: number, y: number): string {
  let i = 0;
  while (i + 1 < bands.length && y >= bands[i + 1][0]) i++;
  const next = bands[i + 1];
  if (next && y >= next[0] - 2 && checker(x, y)) return next[1];
  return bands[i][1];
}

/** The sky in bands, and the sea under it in bands of its own with a ripple through them. */
function skyAndSea(sky: Bands, sea: Bands, ripple: string): Painter {
  return (x, y) => {
    if (y < HORIZON) return band(sky, x, y);
    if (y >= SEA) return null;
    if (hash(x, y) < 0.03 + (y - HORIZON) * 0.002 && (x + y) % 3 === 0) return ripple;
    return band(sea, x, y);
  };
}

const stars: Painter = (x, y) => (y < 84 && hash(x * 7, y * 13) < 0.005 ? (hash(x, y) < 0.5 ? "#ffffff" : "#cdd6ff") : null);

/** The sun, centred on its own origin. */
const sun: Painter = (x, y) => {
  const d2 = x * x + y * y;
  if (d2 < 50) return "#fff6d6";
  if (d2 < 90) return "#ffe08a";
  if (d2 < 150 && checker(x, y)) return "#ffc56b";
  return null;
};

/** Its light on the water: a broken column of glints under it. */
const glitter: Painter = (x, y) => {
  if (y < HORIZON || y >= SEA) return null;
  const spread = 3 + Math.floor((y - HORIZON) / 3);
  if (Math.abs(x - RANGITOTO) > spread) return null;
  return hash(x, y) < 0.35 && y % 2 === 0 ? (hash(x * 3, y) < 0.5 ? "#fff1c2" : "#ffd27a") : null;
};

// ---------------------------------------------------------------- the far side

/** Rangitoto, its low shield dark against the sunrise, the rim behind it catching the light. */
const RANGITOTO = 236;
const rangitotoTop = (x: number) => HORIZON - Math.round(14 * bell((x - RANGITOTO) / 34));

const rangitoto: Painter = (x, y) => {
  const top = rangitotoTop(x);
  if (y < top || y >= HORIZON || top > HORIZON - 2) return null;
  if (y === top) return x > RANGITOTO - 20 && x < RANGITOTO + 20 ? "#e89a8e" : "#8a5f86";
  return hash(x, y) < 0.08 ? "#3f3863" : "#463e6c";
};

const TOWER = 92;
const SPIRE = 64;
const POD: Record<number, [number, number]> = {
  76: [89, 95],
  77: [88, 96],
  78: [88, 96],
  79: [89, 95],
  81: [90, 94],
};

/** `[x, width, height]` standing on the far shore. */
const BUILDINGS: [number, number, number][] = [
  [26, 7, 8],
  [34, 6, 13],
  [41, 8, 20],
  [50, 6, 12],
  [57, 9, 26],
  [67, 6, 17],
  [74, 8, 30],
  [83, 6, 14],
  [99, 8, 24],
  [108, 7, 33],
  [116, 9, 19],
  [126, 6, 12],
  [133, 8, 16],
  [142, 7, 9],
];

const inBuilding = (x: number, y: number) => BUILDINGS.find(([bx, bw, bh]) => x >= bx && x < bx + bw && y >= HORIZON - bh && y < HORIZON);
const isWindow = (x: number, y: number) => {
  const building = inBuilding(x, y);
  if (!building) return false;
  const [bx, bw, bh] = building;
  return bh > 12 && (x - bx) % 2 === 1 && (HORIZON - y) % 3 === 0 && x < bx + bw - 1;
};
const inTower = (x: number, y: number) => {
  const pod = POD[y];
  if (pod && x >= pod[0] && x <= pod[1]) return true;
  return y >= 82 && y < HORIZON && x >= TOWER - 1 && x <= TOWER + 1;
};

const city: Painter = (x, y) => {
  if (x === TOWER && y >= SPIRE && y < 76) return "#565a86";
  if (inTower(x, y)) return x === TOWER - 1 ? "#6a6c98" : "#4b4f7c";
  const building = inBuilding(x, y);
  if (building) return x === building[0] ? "#4a4d7a" : building[2] > 20 ? "#33366a" : "#3a3d6e";
  // The city's reflection, broken by the water under it.
  if (y >= HORIZON && y < HORIZON + 8) {
    const above = inBuilding(x, HORIZON - 1 - (y - HORIZON)) || inTower(x, HORIZON - 1 - (y - HORIZON));
    if (above && checker(x, y) && hash(x, y) < 0.7) return "#3a3a6a";
  }
  return null;
};

/** What is lit while it is still dark: some windows, the tower's pod and a street lamp. */
const cityLights: Painter = (x, y) => {
  const pod = POD[y];
  if (pod && x >= pod[0] && x <= pod[1] && y !== 78) return "#ffd27a";
  if (y >= 82 && y < HORIZON && x === TOWER - 1 && y % 3 === 0) return "#ffd27a";
  if (!inTower(x, y) && isWindow(x, y) && hash(x, y) < 0.4) return "#ffd27a";
  // The lamp on the waterfront, and its pool of light on the footpath.
  if (x === LAMP + 2 && y === 131) return "#fff1c2";
  if (y >= 132 && y <= 134 && Math.abs(x - LAMP - 2) <= 2 && checker(x, y)) return "#ffd27a";
  return null;
};

// ---------------------------------------------------------------- this side of the water

const ROAD = { top: 152, line: 159, bottom: 166 };
const LAMP = 54;

/** A pōhutukawa leaning out over the water at the right, the way they do on every Auckland waterfront. */
const CROWN: [number, number, number][] = [
  [302, 118, 12],
  [286, 124, 10],
  [318, 110, 11],
  [294, 108, 9],
  [312, 128, 9],
];

const near: Painter = (x, y) => {
  // The tree, dark against the dawn, its flowers catching the first light.
  for (const [cx, cy, r] of CROWN) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= r * r - (hash(x, y) < 0.3 ? r : 0)) {
      const n = hash(x * 3, y * 5);
      if (dy < -r / 3 && n < 0.1) return "#ff5a6e";
      if (n < 0.06) return "#b0182f";
      return dx + dy < -r / 2 ? "#2f4a3c" : n < 0.4 ? "#1f3329" : "#243b30";
    }
  }
  if (x >= 300 && x <= 305 && y > 124 && y < ROAD.top) return x === 300 ? "#3a2a22" : "#2a1e18";

  // The lamp post.
  if (x === LAMP && y >= 131 && y < ROAD.top) return "#262a38";
  if (y === 131 && x >= LAMP && x <= LAMP + 3) return "#262a38";

  // The seawall, in blocks, then the road with its centre line, the kerb and the verge.
  if (y >= SEA && y < ROAD.top) return (x + (y % 2) * 4) % 8 === 0 ? "#3a3d4e" : y === SEA ? "#6a6c82" : "#4b4f63";
  if (y >= ROAD.top && y < ROAD.bottom) {
    if (y === ROAD.line && x % 12 < 6) return "#e8d36a";
    return hash(x, y) < 0.05 ? "#3a3e4a" : "#30343f";
  }
  if (y === ROAD.bottom) return "#5b6070";
  if (y > ROAD.bottom) {
    if (y === ROAD.bottom + 1 && hash(x, 1) < 0.4) return "#3f6b4a";
    const n = hash(x * 2, y);
    return n < 0.12 ? "#2a4636" : n < 0.2 ? "#36583f" : "#2f4d3a";
  }
  return null;
};

// ---------------------------------------------------------------- the ute

/** On the near lane, heading right: off to the next job. */
const DRIVE = { ground: ROAD.bottom - 1, rest: 150 };
const driving: Painter = (x, y) => (x >= 0 && x < UTE.width && y >= 0 && y < UTE.height ? ute(x, y) : null);

/**
 * The driver at the window, in the ute's own pixels: cap, face, and the
 * shoulder by the glass. In the front window — between the B-pillar at 41 and
 * the windscreen — not straddling the pillar between the two.
 */
const driverPainter: Painter = (x, y) => {
  if (y === 4 && x >= 43 && x <= 47) return TRADIE_PALETTE.c;
  if (y === 5 && x >= 43 && x <= 48) return x === 48 ? TRADIE_PALETTE.c : TRADIE_PALETTE.h;
  if ((y === 6 || y === 7) && x >= 44 && x <= 46) return TRADIE_PALETTE.s;
  // Down to the sill, so no strip of glass shows under the shoulder.
  if (y === 8 && x >= 43 && x <= 47) return TRADIE_PALETTE.v;
  return null;
};

/**
 * The arm raised from the shoulder behind the head, in the gap between the
 * cap and the B-pillar — in front of the face it read as part of the cap —
 * with a small open hand just over the roof rack.
 */
const wavePainter: Painter = (x, y) => {
  if (y === 0 && x === 42) return TRADIE_PALETTE.k;
  if (y === 1 && (x === 41 || x === 42)) return TRADIE_PALETTE.k;
  if (y >= 2 && y <= 7 && x === 42) return TRADIE_PALETTE.t;
  return null;
};

// ---------------------------------------------------------------- fireworks

const BURST_COLOURS = ["#ff4d8d", "#ffd27a", "#3db8ff", "#2fe0a0", "#a66bff", "#ff7a3d"];

type Spark = { dx: number; dy: number; colour: string };
type Burst = { id: number; x: number; y: number; delay: number; sparks: Spark[] };

/** A ring of sparks and a smaller one inside it, rounded to whole pixels. Only ever built in the browser. */
function burstAt(id: number, x: number, y: number, delay: number): Burst {
  const outer = BURST_COLOURS[Math.floor(Math.random() * BURST_COLOURS.length)];
  const inner = BURST_COLOURS[Math.floor(Math.random() * BURST_COLOURS.length)];
  const sparks: Spark[] = [];
  for (const [count, reach, colour] of [
    [18, 13, outer],
    [10, 7, inner],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const r = reach * (0.85 + Math.random() * 0.3);
      sparks.push({ dx: Math.round(Math.cos(angle) * r), dy: Math.round(Math.sin(angle) * r), colour });
    }
  }
  return { id, x, y, delay, sparks };
}

/** How often the tower lets off a show, and how long one lasts before it is cleared away. */
const SHOW_EVERY_MS = 60_000;
const SHOW_MS = 4_000;

function Fireworks({ active }: { active: boolean }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const next = useRef(0);

  const launch = useCallback(() => {
    const at = next.current;
    next.current += 3;
    setBursts([burstAt(at, TOWER - 10, 30, 0), burstAt(at + 1, TOWER + 12, 24, 0.7), burstAt(at + 2, TOWER - 2, 40, 1.3)]);
    window.setTimeout(() => setBursts([]), SHOW_MS);
  }, []);

  useEffect(() => {
    if (!active) return;
    // A show as the scene comes into view, then one a minute while it stays there.
    launch();
    const timer = window.setInterval(launch, SHOW_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [active, launch]);

  return (
    <g>
      {bursts.map((burst) => (
        <g key={burst.id}>
          {/* The rocket going up from the tip of the spire. */}
          <rect
            className="ak-rocket"
            x={TOWER}
            y={SPIRE}
            width={1}
            height={2}
            fill="#fff1c2"
            style={
              { "--dx": `${burst.x - TOWER}px`, "--dy": `${burst.y - SPIRE}px`, animationDelay: `${burst.delay}s` } as React.CSSProperties
            }
          />
          {burst.sparks.map((spark, index) => (
            <rect
              key={index}
              className="ak-spark"
              x={burst.x}
              y={burst.y}
              width={1}
              height={1}
              fill={spark.colour}
              style={{ "--dx": `${spark.dx}px`, "--dy": `${spark.dy}px`, animationDelay: `${burst.delay + 0.6}s` } as React.CSSProperties}
            />
          ))}
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- drawing

const LAYERS = {
  night: paint(skyAndSea(NIGHT_SKY, NIGHT_SEA, "#3a3a70"), 0, 0, W, SEA),
  dawn: paint(skyAndSea(DAWN_SKY, DAWN_SEA, "#e3a7b4"), 0, 0, W, SEA),
  stars: paint(stars, 0, 0, W, 84),
  sun: paint(sun, -13, -13, 14, 14),
  glitter: paint(glitter, RANGITOTO - 14, HORIZON, RANGITOTO + 15, SEA),
  rangitoto: paint(rangitoto, RANGITOTO - 80, 100, RANGITOTO + 81, HORIZON),
  city: paint(city, 20, SPIRE, 152, HORIZON + 8),
  cityLights: paint(cityLights, 20, 70, 152, 136),
  near: paint(near, 0, 96, W, H),
  ute: paint(driving, 0, 0, UTE.width, UTE.height),
  driver: paint(driverPainter, 30, 2, 50, 10),
  wave: paint(wavePainter, 40, -2, 44, 8),
};

function Paths({ paths }: { paths: [string, string][] }) {
  return (
    <>
      {paths.map(([fill, d]) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </>
  );
}

/** Where the sun sits: under the sea at the start, clear of Rangitoto by the end. */
const SUN_FROM = HORIZON + 12;
const SUN_TO = 92;

/** How long the driver keeps waving after a tap. */
const GREETING_MS = 1800;

export function SunriseScene({
  progress,
  beep,
  pan,
}: {
  progress: MotionValue<number>;
  /** What the bubble says. */
  beep: string;
  /** Where the crop is centred, as a `translateX` of the drawing's width, when the camera moves. */
  pan?: MotionValue<string>;
}) {
  // Counts taps, so each one restarts the wave and the bubble from the top.
  const [greeting, setGreeting] = useState(0);
  const hide = useRef<number | undefined>(undefined);
  const greet = useCallback(() => {
    setGreeting((n) => n + 1);
    window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setGreeting(0), GREETING_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(hide.current), []);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const visible = useInView(ref, { margin: "0px 0px -30% 0px" });
  const dawn = useTransform(progress, [0.1, 0.9], [0, 1]);
  const dark = useTransform(dawn, [0, 0.7], [1, 0]);
  const sunY = useTransform(progress, (v) => Math.round(SUN_FROM + (SUN_TO - SUN_FROM) * Math.min(1, Math.max(0, (v - 0.05) / 0.85))));

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size]" aria-hidden>
      {/* Bottom-aligned and centred like the other drawings; on a phone, centred on the city and the tower. */}
      <motion.div
        className={`absolute bottom-0 left-1/2 aspect-[16/9] w-[max(100cqw,177.78cqh)] [container-type:inline-size] ${
          pan ? "" : "-translate-x-[40%] md:-translate-x-1/2"
        }`}
        style={pan ? { x: pan } : undefined}
      >
        <svg className="ak-scene absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" focusable="false">
          <Paths paths={LAYERS.night} />
          <motion.g style={{ opacity: dawn }}>
            <Paths paths={LAYERS.dawn} />
          </motion.g>
          <motion.g style={{ opacity: dark }}>
            <Paths paths={LAYERS.stars} />
          </motion.g>

          {/* The sun comes up out of the sea behind Rangitoto, which is drawn over it. */}
          <motion.g style={{ x: RANGITOTO, y: sunY }}>
            <Paths paths={LAYERS.sun} />
          </motion.g>
          <motion.g style={{ opacity: dawn }}>
            <Paths paths={LAYERS.glitter} />
          </motion.g>
          <Paths paths={LAYERS.rangitoto} />
          <Paths paths={LAYERS.city} />
          <motion.g style={{ opacity: dark }}>
            <Paths paths={LAYERS.cityLights} />
          </motion.g>
          {!reduced && <Fireworks active={visible} />}

          <Paths paths={LAYERS.near} />
          {/* Parked mid-road when nothing moves; otherwise driving through, left to right, now and then. */}
          <g transform={`translate(${DRIVE.rest} ${DRIVE.ground - UTE.height + 1})`}>
            {/*
              An easter egg, for the pointer only — the whole drawing is decoration, so
              there is nothing here a keyboard or a screen reader is missing: tap the ute
              and its driver leans out to wave, with a beep in a pixel bubble.
            */}
            <g className="ak-drive">
              <g className="ak-bob cursor-pointer [pointer-events:auto]" onClick={greet}>
                <rect x={0} y={0} width={UTE.width} height={UTE.height} fill="transparent" />
                <Paths paths={LAYERS.ute} />
                {greeting > 0 && (
                  <g key={greeting}>
                    <Paths paths={LAYERS.driver} />
                    <g className="ak-wave" style={{ transformOrigin: "50% 100%" }}>
                      <Paths paths={LAYERS.wave} />
                    </g>
                    <g className="ak-pop" style={{ transformOrigin: "50% 100%" }}>
                      <rect x={30} y={-15} width={40} height={10} fill="#fdfbf4" stroke="#17202b" strokeWidth={1} />
                      <rect x={48} y={-5} width={3} height={1} fill="#fdfbf4" />
                      <rect x={49} y={-4} width={1} height={1} fill="#17202b" />
                      <text
                        x={50}
                        y={-7.6}
                        textAnchor="middle"
                        fontSize={5.4}
                        fill="#17202b"
                        style={{ fontFamily: pixelFont.style.fontFamily }}
                      >
                        {beep}
                      </text>
                    </g>
                  </g>
                )}
              </g>
            </g>
          </g>
        </svg>
      </motion.div>
    </div>
  );
}
