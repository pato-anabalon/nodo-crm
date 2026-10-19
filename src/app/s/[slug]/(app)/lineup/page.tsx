import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { personName } from "@/modules/jobs/avatars";
import { jobColour } from "@/modules/jobs/colours";
import { setJobDatesAction } from "@/modules/jobs/actions";
import { dayIn } from "@/modules/jobs/timeline";
import { addDays, isDay, monthStarts, weekStart } from "@/modules/jobs/schedule/calendar";
import { lineupFilterOptions, lineupJobs, lineupMilestones, type LineupFilter } from "@/modules/jobs/schedule/service";
import { LineupChart } from "@/modules/jobs/lineup/lineup-chart";
import { LineupFilters } from "@/modules/jobs/lineup/lineup-filters";

const WEEKS = 12;

export async function generateMetadata() {
  const t = await getTranslations("lineup");
  return { title: t("title") };
}

/**
 * Every job on one timeline: a bar from its start to its end, in its colour,
 * with its milestones marked. What the office looks at to see who is where
 * over the next three months.
 */
export default async function LineupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompanyContext();
  if (!can(ctx, "jobs.read") || !can(ctx, "lineup.read")) notFound();
  const query = await searchParams;
  const t = await getTranslations("lineup");

  const { formatLocale, timezone } = ctx.company;
  const today = dayIn(new Date(), timezone);
  const from = isDay(query.from) ? query.from : null;
  // A fortnight behind today by default: what just finished is context for what starts next.
  const windowStart = weekStart(from ?? addDays(today, -14));
  const days = WEEKS * 7;
  const windowEnd = addDays(windowStart, days - 1);

  const options = await lineupFilterOptions(ctx);
  const filter: LineupFilter = {
    status: query.status === "all" ? "all" : "active",
    memberId: typeof query.member === "string" && options.people.some((p) => p.id === query.member) ? query.member : null,
    tradeId: typeof query.trade === "string" && options.trades.some((tr) => tr.id === query.trade) ? query.trade : null,
  };
  const { dated, undated } = await lineupJobs(ctx, filter, windowStart, windowEnd);
  const milestones = can(ctx, "schedule.read")
    ? await lineupMilestones(ctx, dated.map((job) => job.id), windowStart, windowEnd)
    : [];

  const label = new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "short", timeZone: "UTC" });
  const monthLabel = new Intl.DateTimeFormat(formatLocale, { month: "long", year: "numeric", timeZone: "UTC" });
  const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(windowStart, i * 7)).map((day) => ({
    day,
    label: label.format(asDate(day)),
  }));
  // A heading like "September 2026" takes about eight days' width at the narrowest a day is drawn.
  const months = monthStarts(windowStart, days, 8).map((day) => ({ day, label: monthLabel.format(asDate(day)) }));

  const link = (start: string | null) => {
    const search = new URLSearchParams();
    if (start) search.set("from", start);
    if (filter.status === "all") search.set("status", "all");
    if (filter.memberId) search.set("member", filter.memberId);
    if (filter.tradeId) search.set("trade", filter.tradeId);
    const qs = search.toString();
    return qs ? `/lineup?${qs}` : "/lineup";
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" aria-label={t("earlier")}>
            <Link href={link(addDays(windowStart, -28))}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={link(null)}>{t("today")}</Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label={t("later")}>
            <Link href={link(addDays(windowStart, 28))}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <span className="ml-2 text-sm font-medium">
            {label.format(asDate(windowStart))} – {label.format(asDate(windowEnd))}
          </span>
        </div>
        <LineupFilters
          from={from}
          status={filter.status}
          memberId={filter.memberId}
          tradeId={filter.tradeId}
          people={options.people.map((person) => ({ value: person.id, label: personName(person) }))}
          trades={options.trades.map((trade) => ({ value: trade.id, label: trade.name }))}
        />
      </div>

      {dated.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm italic text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <LineupChart
            rows={dated.map((job) => ({
              id: job.id,
              name: job.name,
              href: `/jobs/${job.id}`,
              colour: jobColour(job),
              startsOn: job.startsOn,
              endsOn: job.endsOn,
              milestones: milestones
                .filter((m) => m.jobId === job.id)
                .map((m) => ({ id: m.id, title: m.title, day: m.startsOn, href: `/jobs/${job.id}/schedule/${m.id}` })),
            }))}
            windowStart={windowStart}
            days={days}
            today={today}
            weeks={weeks}
            months={months}
            canEditDates={can(ctx, "jobs.dates")}
            onDates={setJobDatesAction}
          />
          {can(ctx, "jobs.dates") ? <p className="text-xs text-muted-foreground">{t("dragHint")}</p> : null}
        </>
      )}

      {undated.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("undated", { count: undated.length })}</h2>
          <p className="text-xs text-muted-foreground">{t("undatedHint")}</p>
          <ul className="flex flex-wrap gap-2">
            {undated.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-accent"
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: jobColour(job) }} aria-hidden />
                  {job.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
