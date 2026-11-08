"use client";

import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { CheckCircle2, Eye, MessageCircle, Repeat2, Send } from "lucide-react";
import { useRef } from "react";
import type { RowsCopy } from "../copy";
import { Reveal } from "../reveal";

type Events = RowsCopy["live"]["events"];

const EVENTS: { key: keyof Events; icon: typeof Send; tone: string }[] = [
  { key: "sent", icon: Send, tone: "bg-zinc-950 text-white" },
  { key: "opened", icon: Eye, tone: "bg-[#ffd27a] text-zinc-900" },
  { key: "followUp", icon: Repeat2, tone: "bg-[#bfe0ff] text-zinc-900" },
  { key: "message", icon: MessageCircle, tone: "bg-[#1a4be0] text-white" },
  { key: "accepted", icon: CheckCircle2, tone: "bg-[var(--quote-accepted)] text-white" },
];

function Event({ event, copy, progress, at }: { event: (typeof EVENTS)[number]; copy: Events; progress: MotionValue<number>; at: number }) {
  // Each lights as the line reaches it, and stays lit.
  const opacity = useTransform(progress, [at - 0.12, at], [0.25, 1]);
  const scale = useTransform(progress, [at - 0.12, at], [0.6, 1]);
  const Icon = event.icon;
  const item = copy[event.key];
  return (
    <motion.li style={{ opacity }} className="relative flex gap-4 pb-8 last:pb-0">
      <motion.span style={{ scale }} className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full ${event.tone}`}>
        <Icon className="size-5" aria-hidden />
        {event.key === "opened" && (
          // "Viewing now" is the dot that pulses on the team's own screen.
          <span className="absolute -right-0.5 -top-0.5 flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--quote-accepted)] opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-[var(--quote-accepted)] ring-2 ring-white" />
          </span>
        )}
      </motion.span>
      <div className="pt-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.day}</p>
        <p className="font-semibold text-zinc-950">{item.title}</p>
        <p className="text-sm text-zinc-600">{item.detail}</p>
        {"note" in item && (
          <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">{item.note}</p>
        )}
      </div>
    </motion.li>
  );
}

/**
 * One quote's week, drawn as a line the scroll pulls down: sent, opened,
 * chased on its own, answered — which stops the chasing — and accepted.
 * Asked for less motion, the whole week at once.
 */
export function LiveDemo({ copy, flip = false }: { copy: RowsCopy["live"]; flip?: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 55%"] });
  const whole = useMotionValue(1);
  const progress = reduced ? whole : scrollYProgress;
  const step = 1 / (EVENTS.length - 1);

  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
      <Reveal className={flip ? "md:order-2" : ""}>
        <h3 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-zinc-950 md:text-4xl">{copy.title}</h3>
        <p className="mt-4 max-w-md text-pretty text-lg text-zinc-600">{copy.body}</p>
      </Reveal>

      <div className={`rounded-3xl bg-zinc-50 p-6 ring-1 ring-zinc-200 md:p-10 ${flip ? "md:order-1" : ""}`}>
        <ol ref={ref} className="relative">
          {/* The track, and the line filling it as the week goes by. */}
          <span className="absolute bottom-5 left-5 top-5 w-0.5 -translate-x-1/2 bg-zinc-200" aria-hidden />
          <motion.span
            className="absolute bottom-5 left-5 top-5 w-0.5 origin-top -translate-x-1/2 bg-zinc-950"
            style={{ scaleY: progress }}
            aria-hidden
          />
          {EVENTS.map((event, index) => (
            <Event key={event.key} event={event} copy={copy.events} progress={progress} at={index * step} />
          ))}
        </ol>
      </div>
    </div>
  );
}
