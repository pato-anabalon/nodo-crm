"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Eye, Hammer, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import type { HeroCopy } from "./copy";
import { pixelFont } from "./fonts";

const ORDER = ["lead", "opened", "accepted", "job"] as const;
export type NoticeKind = (typeof ORDER)[number];
type Kind = NoticeKind;

const ICONS: Record<Kind, typeof Inbox> = { lead: Inbox, opened: Eye, accepted: CheckCircle2, job: Hammer };
const TILES: Record<Kind, string> = { lead: "bg-sky-400", opened: "bg-amber-300", accepted: "bg-emerald-400", job: "bg-rose-400" };

/** A notice drawn as a pixel card: hard edges and a hard shadow, to belong to the drawing it floats over. */
export const PIXEL_CARD =
  "flex items-center gap-[0.7em] border-[0.2em] border-[#17202b] bg-[#fdfbf4] px-[0.7em] py-[0.5em] text-[#17202b] shadow-[0.35em_0.35em_0_0_rgba(23,32,43,0.35)]";

/** What goes inside a pixel card: its icon on a coloured tile, a small label and the notice itself. */
export function PixelNotice({ icon: Icon, tile, label, value }: { icon: typeof Inbox; tile: string; label: string; value: string }) {
  return (
    <>
      <span className={`grid size-[2.2em] shrink-0 place-items-center border-[0.18em] border-[#17202b] ${tile}`}>
        <Icon className="size-[1.2em]" strokeWidth={2.5} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.8em] uppercase leading-tight tracking-wide text-[#4a5566]">{label}</span>
        <span className="block truncate leading-tight">{value}</span>
      </span>
    </>
  );
}

/** How many notices have arrived when the page opens, and how long each card waits for the next. */
const START = 3;
const STEP_MS = 2600;

/**
 * One job's life told as the notices it raises — an enquiry, the quote being
 * read, accepted, the job starting — rising one after another over the
 * tradie's head in the hero, the newest at the bottom, nearest them. Drawn as
 * pixel cards with hard edges and a hard shadow, to belong to the drawing.
 * Decoration: what each card says is also what the page goes on to explain.
 * Without motion, the first three simply stand.
 */
export function NotificationStack({
  copy,
  visible = 3,
  onArrive,
}: {
  copy: HeroCopy["notifications"];
  /** How many cards show at once. */
  visible?: number;
  /** Told of each notice as it arrives, so the drawing can answer it. */
  onArrive?: (kind: NoticeKind) => void;
}) {
  const reduced = useReducedMotion();
  // Counted from the same start whatever \`visible\` is, so the stacks for a
  // phone and a desktop always agree on which notice is the newest.
  const [count, setCount] = useState(START);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setCount((n) => n + 1);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [reduced]);

  useEffect(() => {
    if (!reduced && count > START) onArrive?.(ORDER[(count - 1) % ORDER.length]);
  }, [count, reduced, onArrive]);

  const shown = Array.from({ length: visible }, (_, i) => count - visible + i).map((n) => ({
    key: n,
    kind: ORDER[((n % ORDER.length) + ORDER.length) % ORDER.length],
  }));

  return (
    <ol className={`${pixelFont.className} flex w-[22em] flex-col gap-[0.75em]`} aria-hidden>
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map(({ key, kind }, index) => (
          <motion.li
            key={key}
            layout
            initial={{ opacity: 0, y: "2.5em", scale: 0.4 }}
            animate={{ opacity: index === 0 ? 0.7 : 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: "-1.5em", scale: 0.9 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className={`${PIXEL_CARD} origin-bottom-left`}
          >
            <PixelNotice icon={ICONS[kind]} tile={TILES[kind]} label={copy[kind].label} value={copy[kind].value} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
