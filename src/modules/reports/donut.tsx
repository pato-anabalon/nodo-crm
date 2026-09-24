"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

  const total = slices.reduce((acc, slice) => acc + slice.value, 0);
  const ordered = QUOTE_STATUS_ORDER.map((key) =>
    slices.find((s) => s.key === key),
  ).filter((slice): slice is DonutSlice => Boolean(slice));

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
            renderArcs(ordered, total, active, setActive)
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{rate}%</span>
          <span className="max-w-24 text-center text-[11px] leading-tight text-muted-foreground">
            {t("acceptanceRate")}
          </span>
        </div>
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

function renderArcs(
  slices: DonutSlice[],
  total: number,
  active: QuoteStatusKey | null,
  setActive: (key: QuoteStatusKey | null) => void,
) {
  let angle = -90;

  return slices.map((slice) => {
    const sweep = (slice.value / total) * 360;
    if (sweep <= 0) return null;

    // The gap is taken out of the segment itself, so the circle still closes.
    const gap = slices.length > 1 ? Math.min(GAP_DEGREES, sweep / 3) : 0;
    const start = angle + gap / 2;
    const end = angle + sweep - gap / 2;
    angle += sweep;

    return (
      <path
        key={slice.key}
        d={arcPath(start, end)}
        fill="none"
        stroke={`url(#hatch-${slice.key})`}
        strokeWidth={active === slice.key ? THICKNESS + HOVER_GROWTH : THICKNESS}
        className="cursor-default transition-[stroke-width]"
        onMouseEnter={() => setActive(slice.key)}
        onMouseLeave={() => setActive(null)}
      >
        <title>{`${slice.label}: ${slice.formatted}`}</title>
      </path>
    );
  });
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
