"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { JobActionState } from "../actions";
import { barInWindow, daysBetween, shiftDates } from "../schedule/calendar";

/**
 * The narrowest a day is drawn, in pixels. Twelve weeks are then a little over
 * 1,300px, scrolled sideways on a phone; a wider screen stretches the days to
 * fill it, so everything inside the timeline is placed in percentages.
 */
const MIN_DAY_PX = 16;

export type LineupRow = {
  id: string;
  name: string;
  href: string;
  colour: string;
  startsOn: string | null;
  endsOn: string | null;
  milestones: { id: string; title: string; day: string; href: string }[];
  /** A finished job: its dates are no longer anybody's to move. */
  locked: boolean;
};

type Dates = { startsOn: string; endsOn: string };
type Part = "move" | "start" | "end";
/** `dayPx` is measured when the drag starts: the days are as wide as the screen makes them. */
type Drag = { jobId: string; part: Part; originX: number; dayPx: number; delta: number; moved: boolean };

/**
 * Every job as a bar across the weeks, with its milestones over it.
 *
 * Whoever may set a job's dates (`jobs.dates`) moves the bar by dragging it,
 * or stretches it by an end; the arrow keys do the same for anybody without a
 * pointer. The bar moves first and is saved after — through the very action
 * the job's own dates dialog uses — and goes back by itself if refused.
 */
export function LineupChart({
  rows,
  windowStart,
  days,
  today,
  weeks,
  months,
  canEditDates,
  onDates,
}: {
  rows: LineupRow[];
  windowStart: string;
  days: number;
  today: string;
  /** Each week's first day and its label ("13 Oct"). */
  weeks: { day: string; label: string }[];
  months: { day: string; label: string }[];
  canEditDates: boolean;
  onDates: (jobId: string, state: JobActionState, formData: FormData) => Promise<JobActionState>;
}) {
  const t = useTranslations("lineup");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [overrides, setOverride] = useOptimistic<Record<string, Dates>, { jobId: string; dates: Dates }>(
    {},
    (current, next) => ({ ...current, [next.jobId]: next.dates }),
  );
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const minWidth = days * MIN_DAY_PX;
  /** A position along the window, `day` days from its start. */
  const at = (day: number) => `${(day / days) * 100}%`;
  const todayOffset = daysBetween(windowStart, today);

  function datesOf(row: LineupRow): Dates | null {
    const own = overrides[row.id];
    if (own) return own;
    const start = row.startsOn ?? row.endsOn;
    const end = row.endsOn ?? row.startsOn;
    return start && end ? { startsOn: start, endsOn: end } : null;
  }

  function save(row: LineupRow, dates: Dates) {
    const formData = new FormData();
    formData.set("startsOn", dates.startsOn);
    formData.set("endsOn", dates.endsOn);
    startTransition(async () => {
      setOverride({ jobId: row.id, dates });
      const result = await onDates(row.id, {}, formData);
      if (result.error) toast.error(result.error);
      else if (result.fieldErrors) toast.error(Object.values(result.fieldErrors)[0]?.[0] ?? t("notSaved"));
      else if (result.message) toast.success(t("moved", { name: row.name }));
    });
  }

  function onPointerDown(event: PointerEvent<HTMLElement>, row: LineupRow, part: Part) {
    if (!canEditDates || row.locked || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const track = event.currentTarget.closest("[data-track]");
    const dayPx = (track?.getBoundingClientRect().width ?? minWidth) / days;
    const next = { jobId: row.id, part, originX: event.clientX, dayPx, delta: 0, moved: false };
    dragRef.current = next;
    setDrag(next);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const current = dragRef.current;
    if (!current) return;
    const delta = Math.round((event.clientX - current.originX) / current.dayPx);
    const moved = current.moved || Math.abs(event.clientX - current.originX) > 3;
    if (delta === current.delta && moved === current.moved) return;
    const next = { ...current, delta, moved };
    dragRef.current = next;
    setDrag(next);
  }

  function onPointerUp(row: LineupRow) {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current) return;
    // A press that didn't move is a click: open the job.
    if (!current.moved) {
      router.push(row.href);
      return;
    }
    const dates = datesOf(row);
    if (dates && current.delta !== 0) save(row, shiftDates(dates, current.part, current.delta));
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>, row: LineupRow) {
    const dates = datesOf(row);
    if (!dates) return;
    if (event.key === "Enter") {
      router.push(row.href);
      return;
    }
    if (!canEditDates || row.locked || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    // Shift moves the end alone; Alt the start alone; plain arrows the whole bar.
    const part: Part = event.shiftKey ? "end" : event.altKey ? "start" : "move";
    save(row, shiftDates(dates, part, delta));
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="grid" style={{ gridTemplateColumns: `minmax(8rem, 14rem) minmax(${minWidth}px, 1fr)` }}>
        {/* Header: months over weeks. */}
        <div className="sticky left-0 z-20 border-b border-r bg-card" />
        <div className="relative h-12 border-b text-xs text-muted-foreground">
          {months.map((month) => (
            <span
              key={month.day}
              className="absolute top-1 font-semibold text-foreground"
              style={{ left: `calc(${at(Math.max(0, daysBetween(windowStart, month.day)))} + 4px)` }}
            >
              {month.label}
            </span>
          ))}
          {weeks.map((week) => (
            <span
              key={week.day}
              className="absolute bottom-1 border-l pl-1"
              style={{ left: at(daysBetween(windowStart, week.day)) }}
            >
              {week.label}
            </span>
          ))}
        </div>

        {rows.map((row) => {
          const dates = datesOf(row);
          const editable = canEditDates && !row.locked;
          const shifted =
            dates && drag && drag.jobId === row.id && drag.moved ? shiftDates(dates, drag.part, drag.delta) : dates;
          const bar = shifted ? barInWindow(shifted.startsOn, shifted.endsOn, windowStart, days) : null;
          return (
            <div key={row.id} className="contents">
              <div className="sticky left-0 z-10 flex h-11 items-center border-b border-r bg-card px-3">
                <Link href={row.href} className="truncate text-sm font-medium hover:underline" title={row.name}>
                  {row.name}
                </Link>
              </div>
              <div className="relative h-11 border-b" data-track>
                {/* Week lines, where the header's week labels start. */}
                {weeks.slice(1).map((week) => (
                  <span
                    key={week.day}
                    className="absolute inset-y-0 border-l"
                    style={{ left: at(daysBetween(windowStart, week.day)) }}
                    aria-hidden
                  />
                ))}
                {todayOffset >= 0 && todayOffset < days ? (
                  <span className="absolute inset-y-0 w-0.5 bg-primary/60" style={{ left: at(todayOffset + 0.5) }} aria-hidden />
                ) : null}
                {bar ? (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={
                      editable
                        ? t("barEditable", { name: row.name, start: shifted!.startsOn, end: shifted!.endsOn })
                        : t("bar", { name: row.name, start: shifted!.startsOn, end: shifted!.endsOn })
                    }
                    title={`${row.name} · ${shifted!.startsOn} – ${shifted!.endsOn}`}
                    onPointerDown={(event) => onPointerDown(event, row, "move")}
                    onPointerMove={onPointerMove}
                    onPointerUp={() => onPointerUp(row)}
                    onPointerCancel={() => {
                      dragRef.current = null;
                      setDrag(null);
                    }}
                    onClick={() => {
                      // For somebody who can drag, a press that didn't move is
                      // already a click (`onPointerUp`); everybody else just opens it.
                      if (!editable) router.push(row.href);
                    }}
                    onKeyDown={(event) => onKeyDown(event, row)}
                    className={cn(
                      "absolute top-2 flex h-7 select-none items-center overflow-hidden px-2 text-xs font-medium text-white shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      editable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
                      !bar.clippedStart && "rounded-l-md",
                      !bar.clippedEnd && "rounded-r-md",
                      drag?.jobId === row.id && drag.moved && "opacity-80 ring-2 ring-foreground/40",
                    )}
                    style={{ left: at(bar.offset), width: at(bar.length), backgroundColor: row.colour }}
                  >
                    {editable && !bar.clippedStart ? (
                      <span
                        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                        onPointerDown={(event) => onPointerDown(event, row, "start")}
                        aria-hidden
                      />
                    ) : null}
                    <span className="pointer-events-none truncate">{row.name}</span>
                    {editable && !bar.clippedEnd ? (
                      <span
                        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                        onPointerDown={(event) => onPointerDown(event, row, "end")}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                ) : null}
                {row.milestones.map((milestone) => {
                  const offset = daysBetween(windowStart, milestone.day);
                  if (offset < 0 || offset >= days) return null;
                  return (
                    <Link
                      key={milestone.id}
                      href={milestone.href}
                      title={milestone.title}
                      aria-label={t("milestone", { title: milestone.title })}
                      className="absolute top-0.5 z-10 size-3 rotate-45 border-2 border-card bg-amber-500 hover:scale-125"
                      style={{ left: `calc(${at(offset + 0.5)} - 6px)` }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
