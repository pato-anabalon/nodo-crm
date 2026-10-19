"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect } from "react";
import { CLOUDS, H, LAYERS, SHIMMER, TRADIE, TRADIE_PATHS, UTE, W, YACHTS } from "./auckland-art";

/**
 * Auckland by day as pixel art: a 320 × 180 grid scaled up with crisp edges,
 * drawn in layers from the sky forward — dithered sky bands and the sun,
 * drifting clouds and a bank of cumulus resting behind the city, the
 * Waitākere ranges, Rangitoto, the Waitematā, the Harbour Bridge coming down
 * to the shore, the city under the Sky Tower, hills with bush and cabbage
 * trees, harakeke at the left, low scrub along the front and, at the right,
 * a pōhutukawa in flower with a ute parked under it and a tradie sitting on
 * its tailgate, checking their phone, looking out at the city.
 *
 * Every so often a yacht comes in from the gulf, out from behind the
 * pōhutukawa, and sails up the harbour to the city.
 *
 * Each layer moves at its own depth with the scroll and a little with the
 * pointer. Decoration only: the words of the hero carry everything it says.
 */

function Paths({ paths }: { paths: [string, string][] }) {
  return (
    <>
      {paths.map(([fill, d]) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </>
  );
}

/** How far a layer travels: `depth` of 52 pixels down over the scroll, of 6 across with the pointer. */
const travel = (depth: number) => ({
  y: (v: number) => v * depth * 52,
  x: (v: number) => v * depth * -6,
});

const FOREGROUND = 0.55;

function Layer({
  depth,
  scroll,
  pointer,
  children,
}: {
  depth: number;
  scroll: MotionValue<number>;
  pointer: MotionValue<number>;
  children: React.ReactNode;
}) {
  const y = useTransform(scroll, travel(depth).y);
  const x = useTransform(pointer, travel(depth).x);
  return <motion.g style={{ x, y }}>{children}</motion.g>;
}

/**
 * HTML laid over the drawing in its own pixels, moving with the foreground:
 * `--u` is one pixel of the drawing, so anything inside can be placed and
 * sized in the same units the scene was drawn in.
 */
function Overlay({ scroll, pointer, children }: { scroll: MotionValue<number>; pointer: MotionValue<number>; children: React.ReactNode }) {
  const y = useTransform(scroll, (v) => `${(travel(FOREGROUND).y(v) / H) * 100}%`);
  const x = useTransform(pointer, (v) => `${(travel(FOREGROUND).x(v) / W) * 100}%`);
  return (
    <motion.div className="absolute inset-0" style={{ x, y }}>
      {children}
    </motion.div>
  );
}

/**
 * Notices rise over the tradie's head, from just above the ladder on the
 * ute's roof, so the whole of the ute stays in view.
 */
function OverTheHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute"
      style={{
        left: `calc(var(--u) * ${TRADIE.x - 7})`,
        bottom: `calc(var(--u) * ${H - (UTE.ground - UTE.height + 1) + 4})`,
        fontSize: "calc(var(--u) * 2.7)",
      }}
    >
      {children}
    </div>
  );
}

export function AucklandScene({
  scroll,
  cheering = false,
  children,
}: {
  scroll: MotionValue<number>;
  /** The tradie with an arm in the air. */
  cheering?: boolean;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const raw = useMotionValue(0);
  const pointer = useSpring(raw, { stiffness: 40, damping: 18 });

  useEffect(() => {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (event: PointerEvent) => raw.set(event.clientX / window.innerWidth - 0.5);
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [raw, reduced]);

  const still = useMotionValue(0);
  const s = reduced ? still : scroll;
  const p = reduced ? still : pointer;

  return (
    // The drawing covers the hero the way `slice` would — bottom-aligned, centred,
    // cropped at whichever side is longer — but as a box of its own, so the HTML
    // over it can be placed in the drawing's pixels. On a phone, where only a
    // strip of it shows, the strip is the tradie and the ute with the city
    // behind them: centred at 200 of the drawing's 320.
    <div className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size]" aria-hidden>
      <div className="absolute bottom-0 left-1/2 aspect-[16/9] w-[max(100cqw,177.78cqh)] -translate-x-[62.5%] md:-translate-x-1/2 [--u:calc(100cqw/320)] [container-type:inline-size]">
        <svg
          className="ak-scene absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} ${H}`}
          shapeRendering="crispEdges"
          aria-hidden
          focusable="false"
        >
          <Paths paths={LAYERS.sky} />

          <Layer depth={0.04} scroll={s} pointer={p}>
            {CLOUDS.map((c, index) => (
              <g key={index} transform={`translate(0 ${c.y})`}>
                <g
                  className="ak-cloud"
                  style={{
                    animationDuration: `${c.d}s`,
                    animationDelay: `${c.delay}s`,
                  }}
                >
                  <Paths paths={c.paths} />
                </g>
              </g>
            ))}
          </Layer>
          <Layer depth={0.07} scroll={s} pointer={p}>
            <Paths paths={LAYERS.bank} />
          </Layer>

          <Layer depth={0.1} scroll={s} pointer={p}>
            <Paths paths={LAYERS.ranges} />
          </Layer>
          <Layer depth={0.14} scroll={s} pointer={p}>
            <Paths paths={LAYERS.rangitoto} />
          </Layer>

          <Layer depth={0.2} scroll={s} pointer={p}>
            <Paths paths={LAYERS.harbour} />
            {SHIMMER.map(([x, y, w], index) => (
              <rect
                key={index}
                className="ak-shimmer"
                x={x}
                y={y}
                width={w}
                height="1"
                fill="#bfe3ff"
                style={{ animationDelay: `${index * -0.7}s` }}
              />
            ))}
          </Layer>
          <Layer depth={0.22} scroll={s} pointer={p}>
            {/* The bridge moves with the city it lands on, so the two never slide apart. */}
            <Paths paths={LAYERS.bridge} />
            <Paths paths={LAYERS.city} />
          </Layer>

          {/* The yachts sail in front of the city, so its towers never cover a sail. */}
          <Layer depth={0.22} scroll={s} pointer={p}>
            {YACHTS.map((yacht, index) => (
              <g key={index} transform={`translate(${yacht.x} ${yacht.y})`}>
                <g
                  className="ak-arrive"
                  style={{
                    animationDuration: `${yacht.d}s`,
                    animationDelay: `${yacht.delay}s`,
                  }}
                >
                  <g className="ak-bob" style={{ animationDelay: `${index * -1.3}s` }}>
                    <Paths paths={yacht.paths} />
                  </g>
                </g>
              </g>
            ))}
          </Layer>

          <Layer depth={0.36} scroll={s} pointer={p}>
            <Paths paths={LAYERS.hills} />
          </Layer>
          <Layer depth={FOREGROUND} scroll={s} pointer={p}>
            <Paths paths={LAYERS.foreground} />
            <g transform={`translate(${TRADIE.x} ${TRADIE.y})`}>
              <Paths paths={cheering ? TRADIE_PATHS.cheering : TRADIE_PATHS.seated} />
            </g>
          </Layer>
        </svg>
        {children && (
          <Overlay scroll={s} pointer={p}>
            <OverTheHead>{children}</OverTheHead>
          </Overlay>
        )}
      </div>
    </div>
  );
}
