"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { QUOTE_STATUS_COLORS } from "./status-colors";
import { makeShortDateFormatter, makeValueFormatter, type ChartFormat } from "./format-client";
import type { SeriesPoint } from "./series";

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 12, right: 12, bottom: 26, left: 52 };

/**
 * How the quoted value moves within the period.
 *
 * Two lines on a single axis — total and accepted — because they share a unit.
 * Never a second axis: two different scales in one frame make any pair of curves
 * look related.
 */
export function TrendChart({ points, format }: { points: SeriesPoint[]; format: ChartFormat }) {
  const t = useTranslations("reports");
  const [hover, setHover] = useState<number | null>(null);

  // The formatters are built here: only data arrives from the server.
  const formatValue = useMemo(() => makeValueFormatter(format), [format]);
  const formatDate = useMemo(() => makeShortDateFormatter(format.formatLocale), [format.formatLocale]);

  const plot = useMemo(() => {
    const innerWidth = WIDTH - PADDING.left - PADDING.right;
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const max = Math.max(1, ...points.map((point) => point.total));

    const x = (index: number) =>
      PADDING.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const y = (value: number) => PADDING.top + innerHeight - (value / max) * innerHeight;

    const line = (pick: (point: SeriesPoint) => number) =>
      points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(pick(point))}`).join(" ");

    const area = `${line((point) => point.total)} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

    return { x, y, max, innerHeight, totalLine: line((p) => p.total), acceptedLine: line((p) => p.accepted), area };
  }, [points]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noData")}</p>;
  }

  const active = hover === null ? null : points[hover];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-56 w-full min-w-[32rem]"
          role="img"
          aria-label={t("trendTitle")}
          onMouseLeave={() => setHover(null)}
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

          <path d={plot.area} fill={QUOTE_STATUS_COLORS.accepted} opacity={0.08} />
          <path
            d={plot.totalLine}
            fill="none"
            stroke={QUOTE_STATUS_COLORS.accepted}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={plot.acceptedLine}
            fill="none"
            stroke={QUOTE_STATUS_COLORS.awaiting}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {active ? (
            <g>
              <line
                x1={plot.x(hover!)}
                x2={plot.x(hover!)}
                y1={PADDING.top}
                y2={PADDING.top + plot.innerHeight}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={plot.x(hover!)}
                cy={plot.y(active.total)}
                r={4.5}
                fill={QUOTE_STATUS_COLORS.accepted}
                stroke="var(--card)"
                strokeWidth={2}
              />
            </g>
          ) : null}

          {/* Franjas invisibles: el área sensible es mucho mayor que el punto. */}
          {points.map((point, index) => (
            <rect
              key={point.date}
              x={plot.x(index) - (WIDTH / points.length) / 2}
              y={PADDING.top}
              width={WIDTH / points.length}
              height={plot.innerHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}

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
        <LegendItem color={QUOTE_STATUS_COLORS.accepted} label={t("seriesTotal")} />
        <LegendItem color={QUOTE_STATUS_COLORS.awaiting} label={t("seriesAccepted")} dashed />
        {active ? (
          <span className="ml-auto tabular-nums text-muted-foreground">
            {formatDate(active.date)} · {formatValue(active.total)} · {formatValue(active.accepted)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <svg width={18} height={2} aria-hidden>
        <line
          x1={0}
          y1={1}
          x2={18}
          y2={1}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}
