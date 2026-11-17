/**
 * Motion in Apple's two parameters rather than mass, stiffness and damping:
 * the damping ratio (1 settles with no overshoot, below 1 bounces) and the
 * response (seconds to reach the target — not a duration; a spring has none).
 *
 * Critically damped everywhere by default. `momentum` is the one with a bounce,
 * and only after a flick: overshoot on a sheet you threw reads as physics,
 * on a menu that just appeared it reads as a wobble.
 */

export type Spring = { dampingRatio: number; response: number };

export const SPRINGS = {
  /** Toggles, checks, a press. */
  snappy: { dampingRatio: 1, response: 0.25 },
  /** Moving and repositioning: most of the interface. */
  default: { dampingRatio: 1, response: 0.35 },
  /** A sheet opened with a tap. */
  sheet: { dampingRatio: 1, response: 0.3 },
  /** After a flick only — a sheet let go, a to-do swiped. */
  momentum: { dampingRatio: 0.8, response: 0.35 },
} as const satisfies Record<string, Spring>;

export type SpringName = keyof typeof SPRINGS;

/** The same spring as mass-1 physics, which every spring library accepts. */
export function springPhysics({ dampingRatio, response }: Spring) {
  return {
    mass: 1,
    stiffness: (2 * Math.PI / response) ** 2,
    damping: (4 * Math.PI * dampingRatio) / response,
  };
}

/** Motion (the web): `bounce` is the damping ratio's complement. */
export function motionSpring({ dampingRatio, response }: Spring) {
  return { type: "spring" as const, bounce: 1 - dampingRatio, visualDuration: response };
}

/** Reanimated's `withSpring` (the app). */
export function reanimatedSpring({ dampingRatio, response }: Spring) {
  return { dampingRatio, duration: response * 1000 };
}

/** What isn't a gesture — fades, colour — takes a duration, in ms. */
export const DURATIONS = { instant: 100, fast: 150, base: 200, slow: 300 } as const;

/**
 * In and out are mirrors, so something leaves along the path it came in by.
 * As cubic-bézier control points, for CSS and for Reanimated's `Easing.bezier`.
 */
export const EASINGS = {
  enter: [0.2, 0, 0, 1],
  exit: [1, 0, 0.8, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Pressing scales to this on press-in, not on release. */
export const PRESS_SCALE = 0.97;

/**
 * Where a flick would come to rest, as scrolling decelerates — the point a
 * sheet or a carousel picks its destination from, rather than from where the
 * finger let go. Apple's own function, not `v²/2a`.
 *
 * `velocity` in px/s; 0.998 is a scroll view's feel, 0.99 a snappier one.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** With reduced motion, springs and slides become a plain cross-fade. */
export const REDUCED_MOTION_FADE = DURATIONS.base;
