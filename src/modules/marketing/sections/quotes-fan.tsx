"use client";

import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import type { QuotesCopy } from "../copy";
import { Phone } from "../phone";
import { Reveal } from "../reveal";
import { SCREENS } from "../sample";
import { useWide } from "../use-wide";

const STEPS = [
  { key: "build", src: SCREENS.quoteBuilder },
  { key: "share", src: SCREENS.portal },
  { key: "accept", src: SCREENS.accept },
] as const;

/**
 * Where the scroll is when each act begins and ends. The section is already
 * pinned, behind Enquiries, when the count starts; Enquiries finishes sliding
 * off it at about 0.57 — a screen's height into 1.75 — so the phones are already
 * shrinking while they are uncovered, and the heading is there to be uncovered
 * too. What is left after the captions is the finished row, held long enough
 * to be read, and no longer: a third of a screen.
 */
const ACT = {
  spread: [0, 0.74], // the three phones sink, shrink and part
  titleIn: [0.34, 0.6],
  labels: [0.63, 0.82], // as the row settles, so each caption arrives with its phone
} as const;

/** The highest the heading may sit: clear of the bar, which is down by the time this pins. */
const TOP_PX = 96;
/** Room between the heading and the phones while both are on screen. */
const GAP_PX = 40;
/**
 * How the row arrives: large enough to fill the screen, its top a fifth of the
 * way down — Enquiries uncovers the screen from the bottom up, so phones set
 * any higher would show only their feet until it had nearly gone.
 */
const ENTRY_DROP = 0.2; // of the screen's height
const ENTRY_SCALE = 2.7;

const label = (copy: QuotesCopy, key: (typeof STEPS)[number]["key"]) => (
  <>
    <h3 className="text-xl font-semibold">{copy.steps[key].title}</h3>
    <p className="mt-1 text-white/65">{copy.steps[key].body}</p>
  </>
);

/**
 * Build, share, accept — EventBeds' discovery section, in three acts as the
 * page scrolls through it while pinned:
 *
 * 1. The phones arrive large and huddled, the outer two tucked behind.
 * 2. They sink, shrink and part, and the heading rises in above them.
 * 3. Each phone's caption comes up underneath it, and the heading stays.
 *
 * On a phone it is a row to swipe; asked for less motion, the finished row
 * under its heading, standing still.
 */
export function QuotesFan({ copy }: { copy: QuotesCopy }) {
  const wide = useWide();
  const reduced = useReducedMotion();

  const heading = (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-medium text-sky-300">{copy.kicker}</p>
      <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.03em] md:text-6xl">{copy.title}</h2>
      <p className="mt-4 text-lg text-white/70">{copy.body}</p>
    </div>
  );

  if (!wide) {
    return (
      <section id="quotes" className="bg-zinc-950 py-24 text-white">
        <Reveal className="px-5">{heading}</Reveal>
        <ul className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[19vw] pb-6 [scrollbar-width:none]">
          {STEPS.map(({ key, src }) => (
            <li key={key} className="w-[62vw] shrink-0 snap-center">
              <Phone src={src} alt={copy.steps[key].alt} sizes="62vw" />
              <div className="mt-6">{label(copy, key)}</div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (reduced) {
    return (
      <section id="quotes" className="bg-zinc-950 px-8 py-32 text-white">
        {heading}
        <ul className="mx-auto mt-16 grid max-w-5xl grid-cols-3 gap-10">
          {STEPS.map(({ key, src }) => (
            <li key={key} className="mx-auto w-full max-w-[270px]">
              <Phone src={src} alt={copy.steps[key].alt} sizes="270px" />
              <div className="mt-6 text-sm">{label(copy, key)}</div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return <Pinned copy={copy} heading={heading} />;
}

/** Piecewise-linear through `[at, value]` stops, held flat beyond either end. */
function through(v: number, stops: [number, number][]): number {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [a, from] = stops[i - 1];
    const [b, to] = stops[i];
    if (v <= b) return from + ((to - from) * (v - a)) / (b - a);
  }
  return stops[stops.length - 1][1];
}

function Pinned({ copy, heading }: { copy: QuotesCopy; heading: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // Read on every frame, set on resize: where the row rests depends on how tall
  // the heading wraps and how tall the phones and captions come out.
  const rest = useRef(TOP_PX + 220 + GAP_PX);
  // The finished composition — heading, phones, captions — centred on the
  // screen, never higher than the bar allows.
  const titleTop = useMotionValue(TOP_PX);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useEffect(() => {
    const title = titleRef.current;
    const row = rowRef.current;
    if (!title || !row) return;
    const measure = () => {
      // offsetHeight ignores transforms, so this is the row at rest, not mid-scale.
      const top = Math.max(TOP_PX, (window.innerHeight - (title.offsetHeight + GAP_PX + row.offsetHeight)) / 2);
      titleTop.set(top);
      rest.current = top + title.offsetHeight + GAP_PX;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(title);
    observer.observe(row);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [titleTop]);

  // The row's top edge: high on the screen as it is uncovered, then down to rest under the heading.
  const rowY = useTransform(scrollYProgress, (v) =>
    through(v, [
      [ACT.spread[0], ENTRY_DROP * window.innerHeight],
      [ACT.spread[1], rest.current],
    ]),
  );
  const rowScale = useTransform(scrollYProgress, [...ACT.spread], [ENTRY_SCALE, 1]);

  const part = useTransform(scrollYProgress, [...ACT.spread], [0, 1]);
  const leftX = useTransform(part, (v) => `${-(62 + 54 * v)}%`);
  const rightX = useTransform(part, (v) => `${62 + 54 * v}%`);
  const sideY = useTransform(part, (v) => `${8 * (1 - v)}%`);
  const sideScale = useTransform(part, [0, 1], [0.9, 1]);

  const titleOpacity = useTransform(scrollYProgress, [...ACT.titleIn], [0, 1]);
  const titleY = useTransform(scrollYProgress, [...ACT.titleIn], [32, 0]);

  const labelOpacity = useTransform(scrollYProgress, [...ACT.labels], [0, 1]);
  const labelY = useTransform(scrollYProgress, [...ACT.labels], [16, 0]);

  const phone = (step: (typeof STEPS)[number], style?: Record<string, MotionValue<string> | MotionValue<number>>) => (
    <motion.div key={step.key} className={style ? "absolute inset-x-0 top-0" : "relative"} style={style}>
      <Phone src={step.src} alt={copy.steps[step.key].alt} sizes="(min-width: 768px) 360px, 62vw" />
      <motion.div style={{ opacity: labelOpacity, y: labelY }} className="mx-auto mt-6 max-w-[16rem] text-center text-sm">
        {label(copy, step.key)}
      </motion.div>
    </motion.div>
  );

  return (
    // Pulled up a screen's height under Enquiries, which sits above it: by the
    // time Enquiries' foot reaches the bottom of the screen this is already
    // pinned beneath, and is uncovered rather than scrolled in — EventBeds'
    // heading appearing from behind the section before it.
    <section ref={ref} className="relative z-0 bg-zinc-950 text-white" style={{ height: "275vh", marginTop: "-100svh" }}>
      {/* The anchor sits where the overlap ends, so the bar's link lands on the section uncovered, not on Enquiries. */}
      <span id="quotes" className="absolute inset-x-0 top-[100svh]" aria-hidden />
      <div className="sticky top-0 h-[100svh] overflow-hidden px-8">
        <motion.div ref={titleRef} className="absolute inset-x-0 px-8" style={{ top: titleTop, opacity: titleOpacity, y: titleY }}>
          {heading}
        </motion.div>

        {/*
          Sized for the last act, where a phone and its caption have to fit
          under the heading — about 19rem down, with 9rem kept for the caption
          and the margin under it; the earlier acts scale the row up from there.
        */}
        <motion.div
          ref={rowRef}
          className="absolute left-1/2 top-0 w-[min(22vw,270px,calc((100svh-28rem)/2.17))] -translate-x-1/2 origin-top"
          style={{ y: rowY, scale: rowScale }}
        >
          {phone(STEPS[0], { x: leftX, y: sideY, scale: sideScale })}
          {phone(STEPS[2], { x: rightX, y: sideY, scale: sideScale })}
          {phone(STEPS[1])}
        </motion.div>
      </div>
    </section>
  );
}
