"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { QUOTE_STATUS_COLORS } from "./status-colors";
import { TRANSITION_MS, easeOutCubic } from "./animate";
import {
  makeLongDateFormatter,
  makeShortDateFormatter,
  makeValueFormatter,
  type ChartFormat,
} from "./format-client";
import type { SeriesPoint } from "./series";

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 12, right: 12, bottom: 26, left: 52 };
/** The floating tooltip's own box, in the chart's coordinate space — a
 * `foreignObject` so it scales and positions with everything else drawn on
 * the same viewBox, instead of a separate pixel-to-percentage conversion
 * that would drift from it on every container width. */
const TOOLTIP_WIDTH = 170;
const TOOLTIP_HEIGHT = 64;
const TOOLTIP_GAP = 12;

/**
 * A line rests thin and only thickens to its hovered weight for the series
 * under the pointer — the same "grows on hover, back to rest when it isn't"
 * shape as the donut's segments, just on a stroke instead of a ring.
 */
const LINE_WIDTH = 1.5;
const LINE_WIDTH_HOVER = 2;

/**
 * Each area starts soft and only darkens for the series under the pointer.
 * Accepted sits on the same ground as total (see the comment by its path), so
 * its base and hover opacities are both a shade stronger to stay legible
 * layered on top of it.
 */
const TOTAL_AREA_OPACITY = 0.08;
const TOTAL_AREA_OPACITY_HOVER = 0.16;
const ACCEPTED_AREA_OPACITY = 0.12;
const ACCEPTED_AREA_OPACITY_HOVER = 0.22;

/**
 * Quotes, not a status: neutral ink rather than one of the three
 * `--quote-*` tokens, which belong to the donut's accepted/awaiting/declined
 * segments. "Total" isn't any of those three, so it doesn't borrow their colour.
 */
const TOTAL_COLOR = "var(--muted-foreground)";

/**
 * Resamples a series at a position along the timeline — 0 at the first
 * bucket, 1 at the last — rather than by date.
 */
function sampleAt(points: SeriesPoint[], fraction: number): { total: number; accepted: number } {
  if (points.length === 0) return { total: 0, accepted: 0 };
  if (points.length === 1) return { total: points[0].total, accepted: points[0].accepted };

  const position = fraction * (points.length - 1);
  const lowIndex = Math.floor(position);
  const highIndex = Math.min(points.length - 1, lowIndex + 1);
  const t = position - lowIndex;
  const low = points[lowIndex];
  const high = points[highIndex];
  return {
    total: low.total + (high.total - low.total) * t,
    accepted: low.accepted + (high.accepted - low.accepted) * t,
  };
}

/**
 * Tweens the curve toward its new shape instead of snapping to it.
 *
 * A filter change rarely shares a single date between the old period and the
 * new one — a year against the year before shares none — so matching
 * bucket-by-bucket by date, the way the donut matches by status key, would
 * animate almost nothing. What carries over instead is each bucket's
 * *position* along the timeline: the old curve is resampled at the same
 * relative point the new bucket sits at, so the whole shape morphs toward the
 * new one rather than only the buckets that happen to land on the same date.
 */
function useAnimatedSeries(points: SeriesPoint[], duration = TRANSITION_MS): SeriesPoint[] {
  const [animated, setAnimated] = useState(points);
  const currentRef = useRef(points);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = currentRef.current;
    const to = points;
    const sameShape =
      from.length === to.length &&
      to.every(
        (point, index) =>
          from[index].date === point.date &&
          from[index].total === point.total &&
          from[index].accepted === point.accepted,
      );

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    if (sameShape || from.length === 0 || to.length === 0) {
      currentRef.current = to;
      setAnimated(to);
      return;
    }

    let start: number | null = null;
    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = easeOutCubic(progress);
      const next = to.map((point, index) => {
        const fraction = to.length === 1 ? 0 : index / (to.length - 1);
        const sampled = sampleAt(from, fraction);
        return {
          date: point.date,
          total: sampled.total + (point.total - sampled.total) * eased,
          accepted: sampled.accepted + (point.accepted - sampled.accepted) * eased,
        };
      });
      currentRef.current = next;
      setAnimated(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    }
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [points, duration]);

  return animated;
}

/**
 * How the quoted value moves within the period.
 *
 * Two lines on a single axis — total and accepted — because they share a unit.
 * Never a second axis: two different scales in one frame make any pair of curves
 * look related.
 */
export function TrendChart({ points, format }: { points: SeriesPoint[]; format: ChartFormat }) {
  const t = useTranslations("reports");
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Which curve the pointer is over, not just which column: the two series
  // share the same columns, so telling them apart needs the pointer's height
  // too, not only its position along the timeline.
  const [hoverSeries, setHoverSeries] = useState<"total" | "accepted" | null>(null);

  // Tweens toward the new period instead of snapping to it — see the
  // Suspense boundary above this panel, which no longer remounts it on a
  // filter change, so there's a previous curve on screen to tween from.
  const animated = useAnimatedSeries(points);

  // The formatters are built here: only data arrives from the server.
  const formatValue = useMemo(() => makeValueFormatter(format), [format]);
  const formatDate = useMemo(() => makeShortDateFormatter(format.formatLocale), [format.formatLocale]);
  const formatTooltipDate = useMemo(
    () => makeLongDateFormatter(format.formatLocale),
    [format.formatLocale],
  );

  const plot = useMemo(() => {
    const innerWidth = WIDTH - PADDING.left - PADDING.right;
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const max = Math.max(1, ...animated.map((point) => point.total));

    const x = (index: number) =>
      PADDING.left + (animated.length <= 1 ? innerWidth / 2 : (index / (animated.length - 1)) * innerWidth);
    const y = (value: number) => PADDING.top + innerHeight - (value / max) * innerHeight;

    const line = (pick: (point: SeriesPoint) => number) =>
      animated.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(pick(point))}`).join(" ");
    const areaUnder = (pick: (point: SeriesPoint) => number) =>
      `${line(pick)} L ${x(animated.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

    return {
      x,
      y,
      max,
      innerHeight,
      totalLine: line((p) => p.total),
      acceptedLine: line((p) => p.accepted),
      totalArea: areaUnder((p) => p.total),
      acceptedArea: areaUnder((p) => p.accepted),
    };
  }, [animated]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noData")}</p>;
  }

  const active = hover === null ? null : animated[hover];

  // The split is the accepted line itself: below it (inside its own filled
  // area) is "accepted", above it — including the blank space over the grey
  // curve — is "sent". One boundary per column, not two separate hit zones.
  function handlePointerMove(event: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(ctm.inverse());

    const innerWidth = WIDTH - PADDING.left - PADDING.right;
    const ratio = animated.length <= 1 ? 0 : (local.x - PADDING.left) / innerWidth;
    const index = Math.min(
      animated.length - 1,
      Math.max(0, Math.round(ratio * (animated.length - 1))),
    );

    setHover(index);
    setHoverSeries(local.y >= plot.y(animated[index].accepted) ? "accepted" : "total");
  }

  function handlePointerLeave() {
    setHover(null);
    setHoverSeries(null);
  }

  const tooltip =
    active && hoverSeries
      ? {
          x: plot.x(hover!),
          y: hoverSeries === "accepted" ? plot.y(active.accepted) : plot.y(active.total),
          value: hoverSeries === "accepted" ? active.accepted : active.total,
          label: hoverSeries === "accepted" ? t("seriesAccepted") : t("seriesTotal"),
          color: hoverSeries === "accepted" ? QUOTE_STATUS_COLORS.accepted : TOTAL_COLOR,
          date: active.date,
        }
      : null;

  // Flips below the point instead of clipping past the top edge, and clamps
  // sideways instead of running off the left or right of the viewBox.
  const tooltipLeft = tooltip
    ? Math.min(Math.max(tooltip.x - TOOLTIP_WIDTH / 2, 4), WIDTH - TOOLTIP_WIDTH - 4)
    : 0;
  const tooltipAbove = tooltip ? tooltip.y - TOOLTIP_HEIGHT - TOOLTIP_GAP : 0;
  const tooltipTop = tooltip
    ? tooltipAbove >= PADDING.top
      ? tooltipAbove
      : tooltip.y + TOOLTIP_GAP
    : 0;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-56 w-full min-w-[32rem]"
          role="img"
          aria-label={t("trendTitle")}
          onMouseMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
        >
          {/* Rejilla discreta: orienta sin competir con los datos. */}
          {[0, 0.5, 1].map((ratio) => {
            const value = plot.max * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={plot.y(value)}
                  y2={plot.y(value)}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8}
                  y={plot.y(value) + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {formatValue(value)}
                </text>
              </g>
            );
          })}

          <path
            d={plot.totalArea}
            fill={TOTAL_COLOR}
            opacity={hoverSeries === "total" ? TOTAL_AREA_OPACITY_HOVER : TOTAL_AREA_OPACITY}
            className="transition-opacity"
          />
          {/* Painted over the grey wash, not beside it: accepted quotes are a
              subset of the total, so its area is the same ground, re-tinted. */}
          <path
            d={plot.acceptedArea}
            fill={QUOTE_STATUS_COLORS.accepted}
            opacity={hoverSeries === "accepted" ? ACCEPTED_AREA_OPACITY_HOVER : ACCEPTED_AREA_OPACITY}
            className="transition-opacity"
          />
          <path
            d={plot.totalLine}
            fill="none"
            stroke={TOTAL_COLOR}
            strokeWidth={hoverSeries === "total" ? LINE_WIDTH_HOVER : LINE_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="transition-[stroke-width]"
          />
          <path
            d={plot.acceptedLine}
            fill="none"
            stroke={QUOTE_STATUS_COLORS.accepted}
            strokeWidth={hoverSeries === "accepted" ? LINE_WIDTH_HOVER : LINE_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="transition-[stroke-width]"
          />

          {tooltip ? (
            <g>
              <line
                x1={tooltip.x}
                x2={tooltip.x}
                y1={PADDING.top}
                y2={PADDING.top + plot.innerHeight}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {hoverSeries === "accepted" ? (
                <rect
                  x={tooltip.x - 4}
                  y={tooltip.y - 4}
                  width={8}
                  height={8}
                  fill={QUOTE_STATUS_COLORS.accepted}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                  transform={`rotate(45 ${tooltip.x} ${tooltip.y})`}
                />
              ) : (
                <circle
                  cx={tooltip.x}
                  cy={tooltip.y}
                  r={4.5}
                  fill={TOTAL_COLOR}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )}

              {/* An HTML box in the chart's own coordinate space, rather than
                  a separately-positioned overlay: it scales and moves with
                  everything else on the viewBox instead of drifting from it
                  whenever the container's rendered size changes. */}
              <foreignObject
                x={tooltipLeft}
                y={tooltipTop}
                width={TOOLTIP_WIDTH}
                height={TOOLTIP_HEIGHT}
                style={{ overflow: "visible" }}
              >
                <div className="pointer-events-none rounded-md border bg-card px-3 py-2 text-[11px] leading-tight shadow-md">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatValue(tooltip.value)}
                  </p>
                  <p className="font-semibold" style={{ color: tooltip.color }}>
                    {tooltip.label}
                  </p>
                  <p className="text-muted-foreground">{formatTooltipDate(tooltip.date)}</p>
                </div>
              </foreignObject>
            </g>
          ) : null}

          <text x={PADDING.left} y={HEIGHT - 6} className="fill-muted-foreground text-[10px]">
            {formatDate(points[0].date)}
          </text>
          <text
            x={WIDTH - PADDING.right}
            y={HEIGHT - 6}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {formatDate(points[points.length - 1].date)}
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <LegendItem color={TOTAL_COLOR} label={t("seriesTotal")} />
        <LegendItem color={QUOTE_STATUS_COLORS.accepted} label={t("seriesAccepted")} />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <svg width={18} height={2} aria-hidden>
        <line x1={0} y1={1} x2={18} y2={1} stroke={color} strokeWidth={2} />
      </svg>
      {label}
    </span>
  );
}
