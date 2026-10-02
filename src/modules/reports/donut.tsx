"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TRANSITION_MS, easeOutCubic, useAnimatedNumber } from "./animate";
import {
  QUOTE_STATUS_COLORS,
  QUOTE_STATUS_ORDER,
  QUOTE_STATUS_PATTERN,
  type QuoteStatusKey,
} from "./status-colors";

export type DonutSlice = {
  key: QuoteStatusKey;
  value: number;
  count: number;
  label: string;
  formatted: string;
};

const SIZE = 200;
const THICKNESS = 33;
/** How much the hovered segment thickens. */
const HOVER_GROWTH = 6;
/** A hair of room so the thickest stroke never sits right on the viewBox edge. */
const EDGE_MARGIN = 1;
/** A segment rests slightly muted and loads to full colour under the pointer. */
const ARC_OPACITY = 0.85;
const ARC_OPACITY_HOVER = 1;
/** The tooltip's own box, in the same user-space units as the ring. */
const TOOLTIP_WIDTH = 132;
const TOOLTIP_HEIGHT = 62;
const TOOLTIP_GAP = 10;

/**
 * The radius allows for the *thickest* the ring ever gets, not its resting size.
 *
 * A stroke is painted half inside and half outside its path, so sizing this for
 * `THICKNESS` alone put the hovered segment three pixels past the viewBox, where
 * the SVG clipped it into a flat edge.
 */
const RADIUS = (SIZE - THICKNESS - HOVER_GROWTH) / 2 - EDGE_MARGIN;
/** Gap between segments, in degrees: the gap is what separates them without a border. */
const GAP_DEGREES = 2;

/**
 * Tweens each slice's value toward its new figure, matched by status key.
 *
 * Only the ring reads these — the legend shows the new period's formatted
 * amounts immediately, since a half-formatted currency string mid-count would
 * read as a glitch, not a transition. The ring can animate because an arc's
 * sweep is just a number.
 */
function useAnimatedSlices(
  slices: DonutSlice[],
  duration = TRANSITION_MS,
): DonutSlice[] {
  const [animated, setAnimated] = useState(slices);
  const currentRef = useRef(slices);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = currentRef.current;
    const to = slices;
    const fromByKey = new Map(from.map((slice) => [slice.key, slice.value]));
    const changed = to.some(
      (slice) => (fromByKey.get(slice.key) ?? slice.value) !== slice.value,
    );

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    if (!changed) {
      currentRef.current = to;
      setAnimated(to);
      return;
    }

    let start: number | null = null;
    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = easeOutCubic(progress);
      const next = to.map((slice) => {
        const fromValue = fromByKey.get(slice.key) ?? slice.value;
        return { ...slice, value: fromValue + (slice.value - fromValue) * eased };
      });
      currentRef.current = next;
      setAnimated(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    }
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [slices, duration]);

  return animated;
}

/**
 * Quotes split by status.
 *
 * The centre carries the acceptance rate, which is the number actually being
 * read; the ring only gives the proportion. Each segment also carries a texture,
 * so it doesn't depend on colour.
 */
export function StatusDonut({
  slices,
  rate,
  rateLabel,
}: {
  slices: DonutSlice[];
  rate: number;
  rateLabel: string;
}) {
  const t = useTranslations("reports");
  const [active, setActive] = useState<QuoteStatusKey | null>(null);

  // The ring tweens toward the new period; the legend's formatted figures
  // switch straight to it, so only the arcs and the centre percentage move.
  const animatedSlices = useAnimatedSlices(slices);
  const animatedRate = useAnimatedNumber(rate);

  const ordered = QUOTE_STATUS_ORDER.map((key) =>
    slices.find((s) => s.key === key),
  ).filter((slice): slice is DonutSlice => Boolean(slice));
  const animatedOrdered = QUOTE_STATUS_ORDER.map((key) =>
    animatedSlices.find((s) => s.key === key),
  ).filter((slice): slice is DonutSlice => Boolean(slice));
  const total = animatedOrdered.reduce((acc, slice) => acc + slice.value, 0);
  // The real total, not the animating one: the tooltip's share and amount are
  // numbers already settled, same as the legend beside it — see the note on
  // `useAnimatedSlices` about why only the ring itself reads the tween.
  const realTotal = ordered.reduce((acc, slice) => acc + slice.value, 0);

  const layout = layoutArcs(animatedOrdered, total);
  const activeArc = layout.find((entry) => entry.slice.key === active) ?? null;
  const activeSlice = active ? ordered.find((slice) => slice.key === active) ?? null : null;

  const tooltip =
    activeArc && activeSlice
      ? (() => {
          const mid = (activeArc.start + activeArc.end) / 2;
          const anchor = point(SIZE / 2, RADIUS + THICKNESS / 2 + TOOLTIP_GAP, mid);
          const share = realTotal > 0 ? Math.round((activeSlice.value / realTotal) * 100) : 0;
          return {
            x: anchor.x,
            y: anchor.y,
            share,
            label: activeSlice.label,
            formatted: activeSlice.formatted,
            color: QUOTE_STATUS_COLORS[activeSlice.key],
          };
        })()
      : null;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={rateLabel}
        >
          <defs>
            {QUOTE_STATUS_ORDER.map((key) => (
              <pattern
                key={key}
                id={`hatch-${key}`}
                width={6}
                height={6}
                patternTransform={`rotate(${QUOTE_STATUS_PATTERN[key]})`}
                patternUnits="userSpaceOnUse"
              >
                <rect width={6} height={6} fill={QUOTE_STATUS_COLORS[key]} />
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={6}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                  opacity={0.35}
                />
              </pattern>
            ))}
          </defs>

          {total === 0 ? (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={THICKNESS}
            />
          ) : (
            renderArcs(layout, active, setActive)
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">
            {Math.round(animatedRate)}%
          </span>
          <span className="max-w-24 text-center text-[11px] leading-tight text-muted-foreground">
            {t("acceptanceRate")}
          </span>
        </div>

        {tooltip ? (
          // A plain HTML overlay, not a `foreignObject` inside the svg: that
          // painted behind the centre label above, which comes later in the
          // DOM than the svg and so always stacks on top of anything drawn
          // inside it. The ring isn't scaled from its viewBox (width/height
          // equal SIZE), so the anchor's units are already real pixels here.
          <div
            className="pointer-events-none absolute z-10 rounded-md border bg-card px-3 py-2 text-[11px] leading-tight shadow-md"
            style={{
              left: Math.min(Math.max(tooltip.x - TOOLTIP_WIDTH / 2, -TOOLTIP_GAP), SIZE - TOOLTIP_WIDTH + TOOLTIP_GAP),
              top: Math.min(Math.max(tooltip.y - TOOLTIP_HEIGHT / 2, -TOOLTIP_GAP), SIZE - TOOLTIP_HEIGHT + TOOLTIP_GAP),
              width: TOOLTIP_WIDTH,
            }}
          >
            <p className="text-sm font-semibold tabular-nums text-foreground">{tooltip.share}%</p>
            <p className="font-semibold" style={{ color: tooltip.color }}>
              {tooltip.label}
            </p>
            <p className="text-muted-foreground">{tooltip.formatted}</p>
          </div>
        ) : null}
      </div>

      {/* With three series a legend is compulsory: identity is never left to
          colour alone. */}
      <ul className="min-w-0 flex-1 space-y-2">
        {ordered.map((slice) => (
          <li
            key={slice.key}
            onMouseEnter={() => setActive(slice.key)}
            onMouseLeave={() => setActive(null)}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: QUOTE_STATUS_COLORS[slice.key] }}
              />
              <span className="truncate text-muted-foreground">
                {slice.label}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {slice.formatted}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ArcLayout = { slice: DonutSlice; start: number; end: number };

/**
 * Each segment's start and end angle, in drawing order.
 *
 * Shared by `renderArcs` and the tooltip's anchor: both need the same angles,
 * and computing them twice is how the two drift apart.
 */
function layoutArcs(slices: DonutSlice[], total: number): ArcLayout[] {
  let angle = -90;
  const layout: ArcLayout[] = [];

  for (const slice of slices) {
    const sweep = total > 0 ? (slice.value / total) * 360 : 0;
    if (sweep <= 0) continue;

    // The gap is taken out of the segment itself, so the circle still closes.
    const gap = slices.length > 1 ? Math.min(GAP_DEGREES, sweep / 3) : 0;
    const start = angle + gap / 2;
    const end = angle + sweep - gap / 2;
    angle += sweep;
    layout.push({ slice, start, end });
  }

  return layout;
}

function renderArcs(
  layout: ArcLayout[],
  active: QuoteStatusKey | null,
  setActive: (key: QuoteStatusKey | null) => void,
) {
  // No `<title>` here: the foreignObject tooltip now carries this same
  // information, and the browser's native title bubble alongside it would
  // just be a second, slower-appearing tooltip saying the same thing.
  return layout.map(({ slice, start, end }) => (
    <path
      key={slice.key}
      d={arcPath(start, end)}
      fill="none"
      stroke={`url(#hatch-${slice.key})`}
      strokeWidth={active === slice.key ? THICKNESS + HOVER_GROWTH : THICKNESS}
      opacity={active === slice.key ? ARC_OPACITY_HOVER : ARC_OPACITY}
      className="cursor-default transition-[stroke-width,opacity]"
      onMouseEnter={() => setActive(slice.key)}
      onMouseLeave={() => setActive(null)}
    />
  ));
}

function arcPath(startDeg: number, endDeg: number): string {
  const center = SIZE / 2;
  const start = point(center, RADIUS, startDeg);
  const end = point(center, RADIUS, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  // A 360° arc can't be drawn in one go: it's split into two semicircles.
  if (endDeg - startDeg >= 359.9) {
    const mid = point(center, RADIUS, startDeg + 180);
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 1 1 ${mid.x} ${mid.y} A ${RADIUS} ${RADIUS} 0 1 1 ${start.x} ${start.y}`;
  }

  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function point(center: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}
