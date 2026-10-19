"use client";

import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { CalendarRange, CheckCircle2, CheckSquare, Images, MessageCircle, MessagesSquare, UserCheck } from "lucide-react";
import { useRef, useState } from "react";
import type { JobsCopy } from "../copy";
import { pixelFont } from "../fonts";
import { JobSiteScene, SWEEP } from "../job-site-scene";
import { PIXEL_CARD, PixelNotice } from "../notification-stack";
import { Reveal } from "../reveal";
import { useWide } from "../use-wide";

type Tool = keyof JobsCopy["cards"];
type Stage = keyof JobsCopy["stages"];

const TOOLS: Record<Tool, { icon: typeof CheckSquare; tile: string }> = {
  schedule: { icon: CalendarRange, tile: "bg-sky-400" },
  people: { icon: UserCheck, tile: "bg-violet-300" },
  board: { icon: MessagesSquare, tile: "bg-amber-300" },
  files: { icon: Images, tile: "bg-rose-400" },
  todos: { icon: CheckSquare, tile: "bg-emerald-400" },
  chat: { icon: MessageCircle, tile: "bg-orange-300" },
};

/**
 * The four stages of the job, which tools each one shows off, and where on
 * the scroll it begins: each starts as its change starts sweeping across the
 * house. The handover has no tool of its own — it is the job done.
 */
const STAGES: { key: Stage; tools: Tool[]; from: number }[] = [
  { key: "prep", tools: ["schedule", "people"], from: 0 },
  { key: "render", tools: ["board", "files"], from: SWEEP.render[0] },
  { key: "paint", tools: ["todos", "chat"], from: SWEEP.paint[0] - 0.04 },
  { key: "done", tools: [], from: SWEEP.finish[0] },
];

const stageAt = (v: number) => STAGES.findLastIndex((stage) => v >= stage.from);

/** The notices one stage raises, as pixel cards over the roof. */
function Notices({ copy, stage }: { copy: JobsCopy; stage: number }) {
  const { tools } = STAGES[stage];
  const items =
    tools.length > 0
      ? tools.map((tool) => ({ key: tool, ...TOOLS[tool], label: copy.cards[tool].label, value: copy.cards[tool].value }))
      : [{ key: "done", icon: CheckCircle2, tile: "bg-emerald-400", label: copy.done.label, value: copy.done.value }];
  return (
    <ol className={`${pixelFont.className} flex w-[22em] flex-col gap-[0.75em]`}>
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item, index) => (
          <motion.li
            key={item.key}
            layout
            initial={{ opacity: 0, y: "2.5em", scale: 0.4 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: "-1.5em", scale: 0.9 }}
            transition={{ type: "spring", stiffness: 240, damping: 24, delay: index * 0.12 }}
            className={`${PIXEL_CARD} origin-bottom-left`}
          >
            <PixelNotice icon={item.icon} tile={item.tile} label={item.label} value={item.value} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

/** What a stage is about, in words: its tools, or for the handover, the job done. */
function Captions({ copy, stage }: { copy: JobsCopy; stage: number }) {
  const { tools } = STAGES[stage];
  const items = tools.length > 0 ? tools.map((tool) => ({ key: tool, ...copy.cards[tool] })) : [{ key: "done", ...copy.done }];
  return items.map((item) => (
    <div key={item.key}>
      <h3 className="text-lg font-semibold">{item.title}</h3>
      <p className="mt-1 text-white/80">{item.body}</p>
    </div>
  ));
}

/** The stages as pixel chips, the current one lit. */
function Stepper({ copy, stage }: { copy: JobsCopy; stage: number }) {
  return (
    <ol className={`${pixelFont.className} flex flex-wrap gap-2 text-sm`}>
      {STAGES.map(({ key }, index) => (
        <li
          key={key}
          aria-current={index === stage ? "step" : undefined}
          className={`border-2 px-2.5 py-1 transition-colors ${
            index === stage
              ? "border-[#17202b] bg-[#fdfbf4] text-[#17202b]"
              : index < stage
                ? "border-white/60 text-white"
                : "border-white/30 text-white/60"
          }`}
        >
          {index + 1}. {copy.stages[key]}
        </li>
      ))}
    </ol>
  );
}

function Heading({ copy, className = "" }: { copy: JobsCopy; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-[#ffd27a]">{copy.kicker}</p>
      <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.03em] md:text-6xl">{copy.title}</h2>
      <p className="mt-4 max-w-xl text-pretty text-lg text-white/85">{copy.body}</p>
    </div>
  );
}

/**
 * Jobs, told as one job: a house built in pixel art while the section is
 * pinned, from bare sheets to the handover, with the tools of each stage
 * rising over its roof as notices — the hero's story carried on to its end.
 *
 * On a phone, or asked for less motion, the finished house at night, and the
 * stages and their tools as a list underneath.
 */
export function JobSite({ copy }: { copy: JobsCopy }) {
  const wide = useWide();
  const reduced = useReducedMotion();
  return wide && !reduced ? <Pinned copy={copy} /> : <Still copy={copy} />;
}

function Pinned({ copy }: { copy: JobsCopy }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [stage, setStage] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setStage(stageAt(v)));
  const done = STAGES[stage].key === "done";

  return (
    <section id="jobs" ref={ref} className="relative bg-[#0a1433] text-white" style={{ height: "420vh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <JobSiteScene progress={scrollYProgress} cheering={done}>
          <Notices copy={copy} stage={stage} />
        </JobSiteScene>
        {/* The same wash as the hero's, so the sky never sits under white type. */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-[80%] w-[65%] bg-gradient-to-r from-[#0e2a5c]/75 via-[#0e2a5c]/35 to-transparent [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-8 pt-28">
          <Heading copy={copy} />
          <div className="mt-8">
            <Stepper copy={copy} stage={stage} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-6 grid max-w-md gap-4"
            >
              <Captions copy={copy} stage={stage} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Still({ copy }: { copy: JobsCopy }) {
  const finished = useMotionValue(1);
  return (
    <section id="jobs" className="bg-[#0a1433] text-white">
      <div className="relative h-[70svh] md:h-[90svh]">
        <JobSiteScene progress={finished} cheering />
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#0a1433] to-transparent" aria-hidden />
        <Reveal className="relative mx-auto max-w-7xl px-5 pt-24 md:px-8">
          <Heading copy={copy} />
        </Reveal>
      </div>
      <ol className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-4 md:px-8">
        {STAGES.map(({ key }, index) => (
          <Reveal as="li" key={key} delay={index * 0.08}>
            <p className={`${pixelFont.className} text-sm text-[#ffd27a]`}>
              {index + 1}. {copy.stages[key]}
            </p>
            <div className="mt-4 grid gap-4">
              <Captions copy={copy} stage={index} />
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
