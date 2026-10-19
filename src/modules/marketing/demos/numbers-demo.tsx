"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import type { RowsCopy } from "../copy";
import { Reveal } from "../reveal";

/**
 * Example figures, and labelled as such on the card: what a quarter might
 * look like, never a claim about anybody's business.
 */
const QUOTES = { accepted: 31, awaiting: 14, declined: 9 } as const;
const FUNNEL = { enquiries: 120, quoted: 54, won: 31 } as const;

/** The same three colours the reports use, so the demo reads the way the real panel does. */
const COLOURS = {
  accepted: "var(--quote-accepted)",
  awaiting: "var(--quote-awaiting)",
  declined: "var(--quote-declined)",
} as const;

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * A reports panel that assembles itself as it comes into view: the ring of
 * accepted, awaiting and declined, the funnel from enquiry to won, and the
 * median time to accept.
 */
export function NumbersDemo({ copy, flip = false }: { copy: RowsCopy["numbers"]; flip?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });

  const total = QUOTES.accepted + QUOTES.awaiting + QUOTES.declined;
  const share = Math.round((QUOTES.accepted / total) * 100);
  let start = 0;
  const segments = (Object.keys(QUOTES) as (keyof typeof QUOTES)[]).map((key) => {
    const length = (QUOTES[key] / total) * CIRCUMFERENCE;
    const segment = { key, length, offset: start };
    start += length;
    return segment;
  });

  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
      <Reveal className={flip ? "md:order-2" : ""}>
        <h3 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-zinc-950 md:text-4xl">{copy.title}</h3>
        <p className="mt-4 max-w-md text-pretty text-lg text-zinc-600">{copy.body}</p>
      </Reveal>

      <div
        ref={ref}
        className={`rounded-3xl bg-white p-6 shadow-[0_30px_80px_-20px_rgba(10,20,40,0.3)] ring-1 ring-zinc-950/10 md:p-8 ${flip ? "md:order-1" : ""}`}
      >
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold text-zinc-950">{copy.period}</span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">{copy.example}</span>
        </div>

        <div className="mt-6 flex items-center gap-6">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#f4f4f5" strokeWidth="12" />
              {segments.map(({ key, length, offset }, index) => (
                <motion.circle
                  key={key}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke={COLOURS[key]}
                  strokeWidth="12"
                  strokeDashoffset={-offset}
                  initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
                  animate={seen ? { strokeDasharray: `${length} ${CIRCUMFERENCE}` } : undefined}
                  transition={{ duration: 0.9, delay: 0.2 + index * 0.35, ease: EASE }}
                />
              ))}
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-zinc-950">{share}%</p>
                <p className="text-xs text-zinc-500">{copy.acceptedShare}</p>
              </div>
            </div>
          </div>
          <ul className="grid gap-2 text-sm">
            {(Object.keys(QUOTES) as (keyof typeof QUOTES)[]).map((key) => (
              <li key={key} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: COLOURS[key] }} />
                <span className="text-zinc-700">{copy[key]}</span>
                <span className="ml-auto pl-4 font-medium tabular-nums text-zinc-950">{QUOTES[key]}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-sm font-semibold text-zinc-950">{copy.funnel}</p>
        <div className="mt-3 grid gap-2">
          {(Object.keys(FUNNEL) as (keyof typeof FUNNEL)[]).map((key, index) => (
            <div key={key} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-zinc-600">{copy[key]}</span>
              <span className="h-3 overflow-hidden rounded-full bg-zinc-100">
                <motion.span
                  className="block h-full rounded-full bg-[#1a4be0]"
                  initial={{ width: 0 }}
                  animate={seen ? { width: `${(FUNNEL[key] / FUNNEL.enquiries) * 100}%` } : undefined}
                  transition={{ duration: 0.9, delay: 0.5 + index * 0.2, ease: EASE }}
                />
              </span>
              <span className="text-right font-medium tabular-nums text-zinc-950">{FUNNEL[key]}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-baseline justify-between gap-4 border-t border-zinc-100 pt-5">
          <span className="text-sm text-zinc-600">{copy.median}</span>
          <span className="text-xl font-semibold tabular-nums text-zinc-950">{copy.medianValue}</span>
        </div>
      </div>
    </div>
  );
}
