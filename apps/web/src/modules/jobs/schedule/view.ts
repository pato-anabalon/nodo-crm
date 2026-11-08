import { dayKey } from "../schemas";
import type { Span } from "./calendar";

/** One thing on a calendar day: an event, a milestone, or a to-do falling due. */
export type CalendarItem = Span & {
  title: string;
  href: string;
  kind: "event" | "milestone" | "todo";
  /** "7:30" for a timed event; null for anything all-day. */
  time: string | null;
};

/**
 * Formatting in the company's locale and timezone, built once per page. Days
 * are formatted at UTC because they are already the company's days; instants
 * go through its timezone.
 */
export function scheduleFormatters(formatLocale: string, timeZone: string) {
  const day = new Intl.DateTimeFormat(formatLocale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const shortDay = new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "short", timeZone: "UTC" });
  const longDay = new Intl.DateTimeFormat(formatLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const time = new Intl.DateTimeFormat(formatLocale, { hour: "numeric", minute: "2-digit", timeZone });
  const asDay = (key: string) => new Date(`${key}T00:00:00Z`);
  return {
    day: (key: string) => day.format(asDay(key)),
    shortDay: (key: string) => shortDay.format(asDay(key)),
    longDay: (key: string) => longDay.format(asDay(key)),
    time: (instant: Date) => time.format(instant),
  };
}

export type ScheduleFormatters = ReturnType<typeof scheduleFormatters>;

type EventTimes = {
  allDay: boolean;
  startsOn: Date;
  endsOn: Date;
  startsAt: Date | null;
  endsAt: Date | null;
};

/**
 * When an event happens, in words: "Tue 20 Oct", "20 Oct – 22 Oct",
 * "Tue 20 Oct, 7:30 – 9:00", or the two ends with their times when a timed
 * event runs over several days.
 */
export function eventWhen(event: EventTimes, f: ScheduleFormatters): string {
  const start = dayKey(event.startsOn)!;
  const end = dayKey(event.endsOn)!;
  const oneDay = start === end;
  if (event.allDay || !event.startsAt || !event.endsAt) {
    return oneDay ? f.day(start) : `${f.shortDay(start)} – ${f.shortDay(end)}`;
  }
  if (oneDay) return `${f.day(start)}, ${f.time(event.startsAt)} – ${f.time(event.endsAt)}`;
  return `${f.shortDay(start)} ${f.time(event.startsAt)} – ${f.shortDay(end)} ${f.time(event.endsAt)}`;
}

/** The events and the to-dos falling due, as one list a calendar can lay out. */
export function calendarItems(
  jobId: string,
  events: (EventTimes & { id: string; title: string; isMilestone: boolean })[],
  todos: { id: string; title: string; dueOn: Date | null }[],
  f: ScheduleFormatters,
): CalendarItem[] {
  return [
    ...events.map((event) => ({
      id: event.id,
      startsOn: dayKey(event.startsOn)!,
      endsOn: dayKey(event.endsOn)!,
      title: event.title,
      href: `/jobs/${jobId}/schedule/${event.id}`,
      kind: event.isMilestone ? ("milestone" as const) : ("event" as const),
      time: !event.allDay && event.startsAt ? f.time(event.startsAt) : null,
    })),
    ...todos.flatMap((todo) => {
      const due = dayKey(todo.dueOn);
      return due
        ? [{ id: `todo-${todo.id}`, startsOn: due, endsOn: due, title: todo.title, href: `/jobs/${jobId}/todos/${todo.id}`, kind: "todo" as const, time: null }]
        : [];
    }),
  ];
}
