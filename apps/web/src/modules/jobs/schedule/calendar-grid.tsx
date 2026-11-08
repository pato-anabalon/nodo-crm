import Link from "next/link";
import { CheckSquare, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { layoutWeek } from "./calendar";
import type { CalendarItem } from "./view";

/**
 * Weeks as a wall planner: each week one row, with whatever runs several days
 * drawn as a single bar across them. Server-rendered — everything on it is a
 * link, and nothing needs the browser.
 */
export function CalendarGrid({
  weeks,
  items,
  today,
  weekdayLabels,
  dayLabel,
  monthLabel,
  newEventHref,
  addLabel,
}: {
  weeks: string[][];
  items: CalendarItem[];
  today: string;
  weekdayLabels: string[];
  /** The number in the corner of a day. */
  dayLabel: (day: string) => string;
  /** The month's name, shown on the first of the month and the first day drawn. */
  monthLabel: (day: string) => string;
  /** Where clicking an empty day goes to add an event on it, or null. */
  newEventHref: ((day: string) => string) | null;
  addLabel: (day: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {weekdayLabels.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, w) => {
        const segments = layoutWeek(week, items);
        const lanes = segments.reduce((max, s) => Math.max(max, s.lane + 1), 0);
        return (
          <div
            key={week[0]}
            className="relative grid grid-cols-7 border-b last:border-b-0"
            // The first row is the day numbers' own height: the cells span every row,
            // so nothing in that row would otherwise give it one, and the bars
            // would ride up over the numbers.
            style={{ gridTemplateRows: `2rem repeat(${lanes}, auto) minmax(1.5rem, 1fr)` }}
          >
            {/* The day cells sit behind the bars, across every row of the week. */}
            {week.map((day, d) => {
              const isToday = day === today;
              const showMonth = day.endsWith("-01") || (w === 0 && d === 0);
              const cell = (
                <span className="flex items-baseline gap-1 px-1.5 pt-1 text-xs">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full tabular-nums",
                      isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {dayLabel(day)}
                  </span>
                  {showMonth ? <span className="truncate font-medium text-foreground">{monthLabel(day)}</span> : null}
                </span>
              );
              return newEventHref ? (
                <Link
                  key={day}
                  href={newEventHref(day)}
                  aria-label={addLabel(day)}
                  className={cn("min-h-24 border-r last:border-r-0 hover:bg-accent/30", d >= 5 && "bg-muted")}
                  style={{ gridColumn: d + 1, gridRow: `1 / span ${lanes + 2}` }}
                >
                  {cell}
                </Link>
              ) : (
                <div
                  key={day}
                  className={cn("min-h-24 border-r last:border-r-0", d >= 5 && "bg-muted")}
                  style={{ gridColumn: d + 1, gridRow: `1 / span ${lanes + 2}` }}
                >
                  {cell}
                </div>
              );
            })}
            {segments.map((segment) => (
              <Link
                key={`${segment.item.id}-${week[0]}`}
                href={segment.item.href}
                title={segment.item.title}
                className={cn(
                  "z-10 mx-0.5 mb-0.5 flex min-w-0 items-center gap-1 truncate px-1.5 py-0.5 text-xs leading-tight",
                  segment.item.kind === "todo"
                    ? "rounded text-foreground hover:bg-accent"
                    : "bg-primary/15 text-foreground hover:bg-primary/25",
                  segment.item.kind === "milestone" && "bg-amber-500/20 hover:bg-amber-500/30",
                  segment.item.kind !== "todo" && !segment.continuesBefore && "rounded-l-md",
                  segment.item.kind !== "todo" && !segment.continuesAfter && "rounded-r-md",
                )}
                style={{ gridColumn: `${segment.column} / span ${segment.span}`, gridRow: segment.lane + 2 }}
              >
                {segment.item.kind === "milestone" ? <Flag className="size-3 shrink-0 text-amber-600" /> : null}
                {segment.item.kind === "todo" ? <CheckSquare className="size-3 shrink-0 text-muted-foreground" /> : null}
                {segment.item.time ? <span className="shrink-0 font-medium tabular-nums">{segment.item.time}</span> : null}
                <span className="truncate">{segment.item.title}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
