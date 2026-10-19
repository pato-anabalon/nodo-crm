"use client";

import Link from "next/link";
import { motion, useScroll } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AucklandScene } from "./auckland-scene";
import type { HeroCopy } from "./copy";
import { NotificationStack, type NoticeKind } from "./notification-stack";

/** How long the tradie keeps an arm up for an accepted quote. */
const CHEER_MS = 1800;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] as const },
});

/**
 * The first screen: Auckland drawn across the whole of it, the promise on the
 * sky at the left, and on the right a tradie on the tailgate of their ute under
 * a pōhutukawa, looking out at the city, the notices of one job rising over
 * their head — and an arm in the air when the quote comes back accepted.
 */
export function Hero({ copy }: { copy: HeroCopy }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const [cheering, setCheering] = useState(false);
  const cheer = useRef<number | undefined>(undefined);

  const onArrive = useCallback((kind: NoticeKind) => {
    if (kind !== "accepted") return;
    setCheering(true);
    window.clearTimeout(cheer.current);
    cheer.current = window.setTimeout(() => setCheering(false), CHEER_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(cheer.current), []);

  return (
    // Above Quotes as well as Enquiries: on a screen taller than Enquiries,
    // Quotes is pulled up underneath far enough to reach the hero's foot.
    <section ref={ref} className="relative isolate z-10 min-h-[100svh] overflow-hidden bg-[#1f7fe0] text-white">
      <AucklandScene scroll={scrollYProgress} cheering={cheering}>
        {/* None on a tablet, where the drawing is cropped too tight around the city for them. */}
        <div className="hidden lg:block">
          <NotificationStack copy={copy.notifications} onArrive={onArrive} />
        </div>
      </AucklandScene>
      {/* A wash of sky behind the words, so a cloud drifting past never sits under white type. */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-[75%] w-full bg-gradient-to-r from-[#1b74d6]/90 via-[#1f7fe0]/55 to-transparent [mask-image:linear-gradient(to_bottom,black_65%,transparent)] md:w-[70%]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col px-5 pb-[calc(18svh+9rem)] pt-28 md:px-8 md:pb-10 md:pt-70">
        <div className="max-w-2xl">
          <motion.h1
            {...rise(0.1)}
            className="text-balance text-[2.6rem] font-medium leading-[1.05] tracking-[-0.03em] drop-shadow-sm sm:text-6xl lg:text-7xl"
          >
            {copy.title}
          </motion.h1>
          <motion.p {...rise(0.25)} className="mt-6 max-w-xl text-pretty text-lg text-white/90 md:text-xl">
            {copy.subtitle}
          </motion.p>
          <motion.div {...rise(0.4)} className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-xl bg-white px-5 py-3.5 font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-100 active:scale-[0.98]"
            >
              {copy.primary}
            </Link>
            <a
              href="#enquiries"
              className="rounded-xl bg-white/15 px-5 py-3.5 text-white ring-1 ring-white/30 backdrop-blur-md transition hover:bg-white/25"
            >
              {copy.secondary}
            </a>
          </motion.div>
          {/* The bar only arrives below the hero, so the way in for an existing company starts here. */}
          <motion.p {...rise(0.5)} className="mt-5 text-sm text-white/85">
            {copy.signInPrompt}{" "}
            <Link href="/sign-in" className="font-medium text-white underline underline-offset-4 transition hover:decoration-2">
              {copy.signInLink}
            </Link>
          </motion.p>
        </div>

      </div>

      {/*
        On a phone the notices rise over the tradie's head, as they do on a wide
        screen. The drawing covers the hero by its height there, so one of its
        pixels is a 180th of the hero's: the cards start 32 of them up from the
        foot, just over the head, which is 17.8% wherever the hero ends. The words keep that much, and the
        two cards' height, clear at the bottom, so a short screen grows the hero
        rather than putting the cards over the buttons.
      */}
      <div className="absolute bottom-[calc(17.8%+0.5rem)] right-5 z-10 text-[13px] md:hidden">
        <NotificationStack copy={copy.notifications} visible={2} onArrive={onArrive} />
      </div>
    </section>
  );
}
