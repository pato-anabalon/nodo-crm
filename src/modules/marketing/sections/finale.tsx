"use client";

import Link from "next/link";
import { useScroll } from "motion/react";
import { useRef } from "react";
import { Reveal } from "../reveal";
import { SunriseScene } from "../sunrise-scene";

export type FinaleCopy = { title: string; body: string; primary: string; secondary: string; beep: string };

/**
 * The last call to action, over the morning after: the page opened on the
 * afternoon an enquiry came in and spent the night on the job, and it ends at
 * dawn with the ute on its way to the next one. The sun comes up as the page
 * runs out.
 */
export function Finale({ copy }: { copy: FinaleCopy }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });

  return (
    <section ref={ref} className="relative isolate h-[100svh] min-h-[620px] overflow-hidden bg-[#0b1020] text-white">
      <SunriseScene progress={scrollYProgress} beep={copy.beep} />
      {/* Into the footer's ground, so the drawing ends rather than stops. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#0b1020]" aria-hidden />

      <Reveal className="relative mx-auto max-w-3xl px-5 pt-28 text-center md:pt-32">
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
    </section>
  );
}
