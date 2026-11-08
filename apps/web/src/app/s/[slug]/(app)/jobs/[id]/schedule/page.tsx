import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Flag, List, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireJobContext } from "@/modules/jobs/access";
import { AvatarStack } from "@/modules/jobs/avatars";
import { dayIn } from "@/modules/jobs/timeline";
import { dayKey } from "@/modules/jobs/schemas";
import { addDays, calendarWeeks, isDay, weekStart } from "@/modules/jobs/schedule/calendar";
import { eventsBetween, todosDueBetween } from "@/modules/jobs/schedule/service";
import { calendarItems, eventWhen, scheduleFormatters } from "@/modules/jobs/schedule/view";
import { CalendarGrid } from "@/modules/jobs/schedule/calendar-grid";

const WEEKS = 6;
const AGENDA_DAYS = 56;

export async function generateMetadata() {
  const t = await getTranslations("jobs.schedule");
  return { title: t("title") };
}

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { ctx, job } = await requireJobContext(id, "schedule.read");
  const t = await getTranslations("jobs.schedule");

  const { formatLocale, timezone } = ctx.company;
  const today = dayIn(new Date(), timezone);
  const view = query.view === "agenda" ? "agenda" : "calendar";
  const anchor = isDay(query.from) ? query.from : today;
  const from = view === "calendar" ? weekStart(anchor) : anchor;
  const span = view === "calendar" ? WEEKS * 7 : AGENDA_DAYS;
  const to = addDays(from, span - 1);

  const [events, todos] = await Promise.all([
    eventsBetween(ctx, job.id, from, to),
    can(ctx, "todos.read") ? todosDueBetween(ctx, job.id, from, to) : Promise.resolve([]),
  ]);
  const f = scheduleFormatters(formatLocale, timezone);
  const items = calendarItems(job.id, events, todos, f);
  const base = `/jobs/${job.id}/schedule`;
  const href = (next: { view?: string; from?: string }) => {
    const search = new URLSearchParams();
    const v = next.view ?? view;
    if (v === "agenda") search.set("view", "agenda");
    if (next.from) search.set("from", next.from);
    const qs = search.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const canCreate = can(ctx, "schedule.create");
  const range = `${f.shortDay(from)} – ${f.shortDay(to)}`;

  const monday = weekStart(today);
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(formatLocale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${addDays(monday, i)}T00:00:00Z`)),
  );
  const dayNumber = new Intl.DateTimeFormat(formatLocale, { day: "numeric", timeZone: "UTC" });
  const monthName = new Intl.DateTimeFormat(formatLocale, { month: "short", timeZone: "UTC" });

  // The agenda: every day from `from` that has something, in order. Something
  // running several days is listed on the first day shown.
  const agenda = new Map<string, typeof events>();
  for (const event of events) {
    const start = dayKey(event.startsOn)!;
    const key = start < from ? from : start;
    agenda.set(key, [...(agenda.get(key) ?? []), event]);
  }
  const dueByDay = new Map<string, typeof todos>();
  for (const todo of todos) {
    const key = dayKey(todo.dueOn)!;
    dueByDay.set(key, [...(dueByDay.get(key) ?? []), todo]);
  }
  const agendaDays = [...new Set([...agenda.keys(), ...dueByDay.keys()])].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/jobs/${job.id}`} aria-label={t("backToJob", { name: job.name })}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="truncate text-sm text-muted-foreground">{job.name}</p>
          </div>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus className="size-4" />
              {t("newEvent")}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" aria-label={t("earlier")}>
            <Link href={href({ from: addDays(from, -span) })}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href({})}>{t("today")}</Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label={t("later")}>
            <Link href={href({ from: addDays(from, span) })}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <span className="ml-2 text-sm font-medium">{range}</span>
        </div>
        <nav aria-label={t("viewLabel")} className="flex rounded-lg border p-0.5 text-sm">
          {(["calendar", "agenda"] as const).map((option) => (
            <Link
              key={option}
              href={href({ view: option, from: query.from ? anchor : undefined })}
              aria-current={view === option ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-muted-foreground",
                view === option && "bg-muted font-medium text-foreground",
              )}
            >
              {option === "calendar" ? <CalendarDays className="size-4" /> : <List className="size-4" />}
              {t(`views.${option}`)}
            </Link>
          ))}
        </nav>
      </div>

      {view === "calendar" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[44rem]">
            <CalendarGrid
              weeks={calendarWeeks(from, WEEKS)}
              items={items}
              today={today}
              weekdayLabels={weekdayLabels}
              dayLabel={(day) => dayNumber.format(new Date(`${day}T00:00:00Z`))}
              monthLabel={(day) => monthName.format(new Date(`${day}T00:00:00Z`))}
              newEventHref={canCreate ? (day) => `${base}/new?day=${day}` : null}
              addLabel={(day) => t("addOn", { date: f.longDay(day) })}
            />
          </div>
        </div>
      ) : agendaDays.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm italic text-muted-foreground">
          {t("agendaEmpty", { range })}
        </p>
      ) : (
        <ol className="space-y-6">
          {agendaDays.map((day) => (
            <li key={day} className="space-y-2">
              <h2 className={cn("text-sm font-semibold", day === today && "text-primary")}>
                {f.longDay(day)}
                {day === today ? ` · ${t("today")}` : null}
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {(agenda.get(day) ?? []).map((event) => (
                  <li key={event.id}>
                    <Link href={`${base}/${event.id}`} className="flex items-start gap-3 p-3 hover:bg-accent/40">
                      {event.isMilestone ? (
                        <Flag className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      ) : (
                        <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{event.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {event.allDay && dayKey(event.startsOn) === dayKey(event.endsOn) ? t("allDay") : eventWhen(event, f)}
                          {event._count.comments > 0 ? ` · ${t("commentCount", { count: event._count.comments })}` : null}
                        </span>
                      </span>
                      {event.participants.length > 0 ? <AvatarStack people={event.participants.map((p) => p.user)} max={4} /> : null}
                    </Link>
                  </li>
                ))}
                {(dueByDay.get(day) ?? []).map((todo) => (
                  <li key={todo.id}>
                    <Link href={`/jobs/${job.id}/todos/${todo.id}`} className="flex items-start gap-3 p-3 hover:bg-accent/40">
                      <CheckSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block">{todo.title}</span>
                        <span className="block text-xs text-muted-foreground">{t("todoDue")}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
