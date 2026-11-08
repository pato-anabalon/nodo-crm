import { can } from "@/lib/auth/session";
import { addDays } from "@nodo/core/jobs/schedule/calendar";
import { eventsBetween, todosDueBetween } from "@/modules/jobs/schedule/service";
import { dayKey } from "@/modules/jobs/schemas";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { MAX_SCHEDULE_DAYS } from "@/modules/mobile/jobs/schemas";
import { today } from "@/modules/mobile/jobs/views";
import { mobileRoute, MobileError } from "@/modules/mobile/route";

/** A real calendar day, not just its shape: `2026-02-30` would read as March. */
function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * The job's schedule from `?from=` to `?to=` (days, inclusive; four weeks from
 * today without them), laid out by the app as an agenda. Events carry their
 * days and, when timed, their instants — the same shape every view on the web
 * draws from — and to-dos falling due come beside them for whoever reads
 * to-dos. Read only in v1.
 */
export const GET = mobileRoute({
  permission: "schedule.read",
  handler: async ({ ctx: base, params, request }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "schedule.read");
    const search = new URL(request.url).searchParams;
    const from = search.get("from") ?? today(ctx);
    const to = search.get("to") ?? addDays(from, 27);
    if (!isDay(from) || !isDay(to) || to < from || addDays(from, MAX_SCHEDULE_DAYS) < to) {
      throw new MobileError(400, "invalid_range");
    }

    const [events, todos] = await Promise.all([
      eventsBetween(ctx, job.id, from, to),
      can(ctx, "todos.read") ? todosDueBetween(ctx, job.id, from, to) : [],
    ]);
    return {
      from,
      to,
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        allDay: event.allDay,
        milestone: event.isMilestone,
        startsOn: dayKey(event.startsOn),
        endsOn: dayKey(event.endsOn),
        startsAt: event.startsAt?.toISOString() ?? null,
        endsAt: event.endsAt?.toISOString() ?? null,
        participants: event.participants.map((participant) => participant.user),
        comments: event._count.comments,
      })),
      todosDue: todos.map((todo) => ({ id: todo.id, title: todo.title, dueOn: dayKey(todo.dueOn) })),
    };
  },
});
