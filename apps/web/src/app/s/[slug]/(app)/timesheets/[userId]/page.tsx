import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { addDays } from "@nodo/core/jobs/schedule/calendar";
import { dayIn } from "@nodo/core/jobs/timeline";
import { payAmount } from "@nodo/core/timeclock/pay";
import { wallClock } from "@nodo/core/zoned-time";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hoursAndMinutes, type Shift } from "@/modules/timeclock/timesheet";
import { timesheets } from "@/modules/timeclock/timesheet-service";
import { dayTitle, weekFrom, weekRange } from "@/modules/timeclock/week";
import { WeekNav } from "@/modules/timeclock/week-nav";

export async function generateMetadata() {
  const t = await getTranslations("timesheets");
  return { title: t("title") };
}

/**
 * One person's week: each day's shifts with where and when they were
 * punched, the day's breaks, and what is paid. Anybody's with
 * `timeclock.read.all`; one's own with `timeclock.punch`.
 */
export default async function PersonTimesheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("timesheets");
  const { userId } = await params;
  const own = userId === ctx.user.id;
  if (!can(ctx, "timeclock.read.all") && !(own && can(ctx, "timeclock.punch"))) notFound();

  const today = dayIn(new Date(), ctx.company.timezone);
  const { from, to } = weekFrom((await searchParams).week, today);
  const [person] = await timesheets(ctx, from, to, userId);
  // Not a member of this company: the same answer as a person who doesn't exist.
  if (!person) notFound();

  const { formatLocale, currency, timezone, breakPolicy } = ctx.company;
  const seesPay = can(ctx, "timeclock.export");
  const amount = payAmount(person.sheet.paidMinutes, person.hourlyRate);
  const base = `/timesheets/${userId}`;
  const time = (instant: Date) => wallClock(instant, timezone).time;
  const worked = person.sheet.days.filter((day) => day.shifts.length > 0);

  const summary = [
    { label: t("summary.worked"), value: hoursAndMinutes(person.sheet.workedMinutes) },
    { label: t("summary.meal"), value: hoursAndMinutes(person.sheet.unpaidMinutes) },
    { label: t("summary.paid"), value: hoursAndMinutes(person.sheet.paidMinutes) },
    ...(seesPay
      ? [{ label: t("summary.amount"), value: amount === null ? t("noRate") : formatMoney(amount, currency, formatLocale) }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        {can(ctx, "timeclock.read.all") ? (
          <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
            <Link href={`/timesheets?week=${from}`} aria-label={t("back")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{person.name ?? person.email}</h1>
          <p className="text-sm text-muted-foreground">{person.email}</p>
        </div>
      </div>

      <WeekNav
        label={weekRange(from, to, formatLocale)}
        previousHref={`${base}?week=${addDays(from, -7)}`}
        nextHref={`${base}?week=${addDays(from, 7)}`}
        currentHref={from === weekFrom(undefined, today).from ? null : base}
        labels={{ previous: t("previousWeek"), next: t("nextWeek"), current: t("thisWeek") }}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      {worked.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t("emptyPerson")}</p>
      ) : (
        <div className="space-y-4">
          {worked.map((day) => (
            <Card key={day.day}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{dayTitle(day.day, formatLocale)}</h2>
                  <p className="text-sm tabular-nums">
                    {t("day.paid", { hours: hoursAndMinutes(day.paidMinutes) })}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("day.breaks", {
                    worked: hoursAndMinutes(day.workedMinutes),
                    rest: day.restBreaks,
                    restMinutes: breakPolicy.restBreakMinutes,
                    meal: day.unpaidMinutes,
                  })}
                </p>
                <ul className="divide-y">
                  {day.shifts.map((shift) => (
                    <ShiftLine key={shift.id} shift={shift} time={time} t={t} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ShiftLine({
  shift,
  time,
  t,
}: {
  shift: Shift;
  time: (instant: Date) => string;
  t: Awaited<ReturnType<typeof getTranslations<"timesheets">>>;
}) {
  const flags = [
    shift.minutes === null ? t("flags.open") : null,
    shift.source === "MANUAL" ? t("flags.manual") : null,
    shift.editedAt ? t("flags.edited") : null,
    shift.late ? t("flags.late") : null,
    shift.leftAway ? t("flags.leftAway") : null,
  ].filter((flag): flag is string => flag !== null);

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium break-words">
          {shift.jobId ? (
            <Link href={`/jobs/${shift.jobId}`} className="hover:underline">
              {shift.jobName}
            </Link>
          ) : (
            shift.jobName
          )}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {shift.clockOutAt ? t("shift.range", { start: time(shift.clockInAt), end: time(shift.clockOutAt) }) : t("shift.since", { start: time(shift.clockInAt) })}
          {shift.clockInDistanceM !== null ? ` · ${t("shift.distance", { metres: Math.round(shift.clockInDistanceM) })}` : null}
        </p>
        {flags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {flags.map((flag) => (
              <Badge key={flag} variant="outline" className="font-normal">
                {flag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <p className="text-sm tabular-nums">{shift.minutes === null ? "–" : hoursAndMinutes(shift.minutes)}</p>
    </li>
  );
}
