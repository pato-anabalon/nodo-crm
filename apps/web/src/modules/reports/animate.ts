"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared by every chart in this module that tweens toward a new figure
 * instead of snapping to it — the donut's ring and centre percentage, the
 * trend line's curve. One place, so a third chart doesn't reinvent the loop.
 */
export const TRANSITION_MS = 450;

/** Eases a 0–1 animation progress so it settles rather than stopping abruptly. */
export function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * Tweens a single number toward `target` instead of snapping to it.
 *
 * Reads the value it last displayed — including mid-animation — as the start
 * of the next tween, so a second change arriving before the first finishes
 * re-targets smoothly instead of restarting from whatever the props happened
 * to be.
 */
export function useAnimatedNumber(target: number, duration = TRANSITION_MS): number {
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = currentRef.current;
    const to = target;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    if (from === to) {
      currentRef.current = to;
      setValue(to);
      return;
    }

    let start: number | null = null;
    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const next = from + (to - from) * easeOutCubic(progress);
      currentRef.current = next;
      setValue(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    }
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return value;
}
