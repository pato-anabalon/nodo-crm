"use client";

import { useEffect, useState } from "react";
import { useAnimatedNumber } from "@/modules/reports/animate";

/**
 * `useAnimatedNumber`, gated by `prefers-reduced-motion` — the portal's own
 * established convention (`src/lib/celebrate.ts`, on the confetti): reduced
 * motion means the number snaps straight to its new value, never a gentler
 * version of the same tween. Nobody chasing a moving number is spared by
 * making it move more slowly.
 */
export function usePortalAnimatedTotal(target: number): number {
  // The initial read happens during render, via the lazy initialiser — not
  // in an effect, which would mean a synchronous `setState` there purely to
  // mirror something already readable now. The effect below only subscribes.
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const animated = useAnimatedNumber(target);
  return reduced ? target : animated;
}
