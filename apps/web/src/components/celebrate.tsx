"use client";

import { useEffect } from "react";
import { celebrate, type Intensity } from "@/lib/celebrate";

/**
 * Celebrates a state the page is already in, rather than an action somebody
 * just took.
 *
 * That distinction is the whole reason this exists. When a customer accepts,
 * the panel they accepted in unmounts and the page becomes the "accepted"
 * screen — so there is no moment left to hang a callback on. And the team finds
 * out later, by email, and opens the quote when they get to it: for them the
 * news *is* the page load.
 *
 * `onceKey` is what keeps it a celebration. It fires the first time this
 * browser sees this quote in this state and never again.
 */
export function Celebrate({
  onceKey,
  intensity = "full",
}: {
  onceKey: string;
  intensity?: Intensity;
}) {
  useEffect(() => {
    void celebrate({ key: onceKey, intensity });
  }, [onceKey, intensity]);

  return null;
}
