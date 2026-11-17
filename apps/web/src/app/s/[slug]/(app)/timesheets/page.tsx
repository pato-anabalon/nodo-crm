import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { addDays } from "@nodo/core/jobs/schedule/calendar";
import { payAmount } from "@nodo/core/timeclock/pay";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dayIn } from "@nodo/core/jobs/timeline";
import { hoursAndMinutes, daysOf } from "@/modules/timeclock/timesheet";
import { timesheets } from "@/modules/timeclock/timesheet-service";
import { dayHeading, weekFrom, weekRange } from "@/modules/timeclock/week";
import { WeekNav } from "@/modules/timeclock/week-nav";

export async function generateMetadata() {
  const t = await getTranslations("timesheets");
  return { title: t("title") };
}

/**
 * Everybody's week on the clock: hours paid per day — after the day's unpaid
 * meal break — and the week's total, with the amount for a profile that sees
 * pay. A person opens onto their shifts.
 */
export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ week?: string | string[] }> }) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("timesheets");
  if (!can(ctx, "timeclock.read.all")) return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;

  const today = dayIn(new Date(), ctx.company.timezone);
  const { from, to } = weekFrom((await searchParams).week, today);
  const people = await timesheets(ctx, from, to);
  const days = daysOf(from, to);
  const seesPay = can(ctx, "timeclock.export");
  const { formatLocale, currency, breakPolicy } = ctx.company;
  const thisWeek = weekFrom(undefined, today).from;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {seesPay ? (
          <Button asChild variant="outline">
            <Link href={`/timesheets/export?from=${from}&to=${to}`}>
              <Download className="size-4" />
              {t("exportHours")}
            </Link>
          </Button>
        ) : null}
      </div>

      <WeekNav
        label={weekRange(from, to, formatLocale)}
        previousHref={`/timesheets?week=${addDays(from, -7)}`}
        nextHref={`/timesheets?week=${addDays(from, 7)}`}
        currentHref={from === thisWeek ? null : "/timesheets"}
        labels={{ previous: t("previousWeek"), next: t("nextWeek"), current: t("thisWeek") }}
      />

      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t("empty")}</p>
      ) : (
        <TableCard>
          <Table cards>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.person")}</TableHead>
                {days.map((day) => (
                  <TableHead key={day} className="text-right">
                    {dayHeading(day, formatLocale)}
                  </TableHead>
                ))}
                <TableHead className="text-right">{t("columns.total")}</TableHead>
                {seesPay ? <TableHead className="text-right">{t("columns.amount")}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const amount = payAmount(person.sheet.paidMinutes, person.hourlyRate);
                return (
                  <TableRow key={person.userId}>
                    <TableCell primary>
                      <Link href={`/timesheets/${person.userId}?week=${from}`} className="font-medium hover:underline">
                        {person.name ?? person.email}
                      </Link>
                      {person.sheet.flagged ? (
                        <AlertTriangle className="ml-1.5 inline size-3.5 text-[var(--status-viewing)]" aria-label={t("flagged")} />
                      ) : null}
                    </TableCell>
                    {person.sheet.days.map((day) => (
                      <TableCell key={day.day} label={dayHeading(day.day, formatLocale)} className="text-right tabular-nums">
                        {day.paidMinutes > 0 ? (
                          hoursAndMinutes(day.paidMinutes)
                        ) : day.open ? (
                          <span className="text-muted-foreground italic">{t("open")}</span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell label={t("columns.total")} className="text-right font-medium tabular-nums">
                      {hoursAndMinutes(person.sheet.paidMinutes)}
                    </TableCell>
                    {seesPay ? (
                      <TableCell label={t("columns.amount")} className="text-right tabular-nums">
                        {amount === null ? (
                          <span className="text-muted-foreground italic">{t("noRate")}</span>
                        ) : (
                          formatMoney(amount, currency, formatLocale)
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}

      <p className="text-xs text-muted-foreground">
        {breakPolicy.mealBreakMinutes === 0 ? t("paidNoteMealPaid") : t("paidNote", { meal: breakPolicy.mealBreakMinutes })}
      </p>
    </div>
  );
}
