"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Reveal } from "../reveal";
import { SunriseScene } from "../sunrise-scene";
import { useWide } from "../use-wide";

export type FinaleCopy = { title: string; body: string; primary: string; secondary: string; beep: string };

/**
 * The last call to action, over the morning after: the page opened on the
 * afternoon an enquiry came in and spent the night on the job, and it ends at
 * dawn with the ute on its way to the next one. The sun comes up as the page
 * runs out.
 *
 * On a phone the drawing takes the lower part of the screen and the words the
 * sky above it, in a band coloured to run on from it; and since a portrait
 * crop can't hold the Sky Tower and the sunrise at once, the camera starts on
 * the tower — where the first fireworks go up as it comes into view — and
 * pans across to Rangitoto as the sun comes up behind it.
 */
// It stops at 154, not on the sunrise itself: a phone shows about 135–145 of
// the drawing's 320 across, and any further right would push the Sky Tower
// (92) out of the left edge. From there the tower holds the left of the frame
// and Rangitoto's slope, lit from behind, the right.
const CAMERA = { at: [0, 0.35, 1], centre: [112, 112, 154] };
const toPan = (centre: number) => `${-(centre / 320) * 100}%`;
/** The top band of the drawing's sky, from the last of the night to dawn, in step with `SunriseScene`'s own fade. */
const SKY_TOP = { at: [0.1, 0.9], colour: ["#0d1538", "#3a4f9a"] };

export function Finale({ copy }: { copy: FinaleCopy }) {
  const ref = useRef<HTMLElement>(null);
  const wide = useWide();
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const moving = useTransform(scrollYProgress, CAMERA.at, CAMERA.centre.map(toPan));
  // Asked for less motion, the camera stays where the morning ends: on the sunrise.
  const still = useMotionValue(toPan(CAMERA.centre[CAMERA.centre.length - 1]));
  const sky = useTransform(scrollYProgress, SKY_TOP.at, SKY_TOP.colour);

  return (
    <motion.section
      ref={ref}
      className="relative isolate h-[100svh] min-h-[620px] overflow-hidden bg-[#0b1020] text-white"
      style={wide ? undefined : { backgroundColor: sky }}
    >
      {wide ? (
        <SunriseScene progress={scrollYProgress} beep={copy.beep} />
      ) : (
        <div className="absolute inset-x-0 bottom-0 h-[58%]">
          <SunriseScene progress={scrollYProgress} beep={copy.beep} pan={reduced ? still : moving} />
        </div>
      )}
      {/* Into the footer's ground, so the drawing ends rather than stops. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#0b1020]" aria-hidden />

      <Reveal className="relative mx-auto max-w-3xl px-5 pt-20 text-center md:pt-32">
        <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] drop-shadow-sm md:text-6xl">{copy.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">{copy.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-white px-5 py-3.5 font-medium text-zinc-900 transition hover:bg-zinc-100 active:scale-[0.98]"
          >
            {copy.primary}
          </Link>
          <Link
            href="/sign-in"
            className="rounded-xl bg-white/15 px-5 py-3.5 ring-1 ring-white/30 backdrop-blur-md transition hover:bg-white/25"
          >
            {copy.secondary}
          </Link>
        </div>
      </Reveal>
    </motion.section>
  );
}
