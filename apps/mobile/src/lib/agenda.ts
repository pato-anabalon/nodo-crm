import type { Schedule, ScheduleEvent, TodoDue } from "./types";

/**
 * The schedule as an agenda: the days that have something, in order, each
 * with what happens on it. An event is listed once, on the first day of it
 * the window shows — one that began last week reads as "continues", not as a
 * copy per day. All-day things lead the day, then timed ones by their start,
 * then the to-dos falling due. Days are `YYYY-MM-DD` strings, compared as
 * text, the way the calendar geometry in core treats them.
 */

export type AgendaEntry =
  | { kind: "event"; event: ScheduleEvent; continues: boolean; multiDay: boolean }
  | { kind: "todo"; todo: TodoDue };

export type AgendaDay = { day: string; entries: AgendaEntry[] };

export function agendaDays(schedule: Pick<Schedule, "from" | "to" | "events" | "todosDue">): AgendaDay[] {
  const days = new Map<string, AgendaEntry[]>();
  const at = (day: string) => days.get(day) ?? days.set(day, []).get(day)!;

  for (const event of schedule.events) {
    if (event.endsOn < schedule.from || event.startsOn > schedule.to) continue;
    const day = event.startsOn < schedule.from ? schedule.from : event.startsOn;
    at(day).push({ kind: "event", event, continues: event.startsOn < day, multiDay: event.endsOn > event.startsOn });
  }
  for (const todo of schedule.todosDue) {
    if (todo.dueOn >= schedule.from && todo.dueOn <= schedule.to) at(todo.dueOn).push({ kind: "todo", todo });
  }

  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, entries]) => ({ day, entries: entries.sort(byTime) }));
}

function rank(entry: AgendaEntry): [number, string] {
  if (entry.kind === "todo") return [2, entry.todo.title];
  if (entry.event.allDay || entry.continues) return [0, entry.event.title];
  return [1, entry.event.startsAt ?? ""];
}

function byTime(a: AgendaEntry, b: AgendaEntry): number {
  const [ra, ka] = rank(a);
  const [rb, kb] = rank(b);
  return ra - rb || ka.localeCompare(kb);
}
