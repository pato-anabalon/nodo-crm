import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { addDays, isDay } from "@nodo/core/jobs/schedule/calendar";
import { getCompanyContext } from "@/lib/auth/session";
import { MAX_EXPORT_DAYS, TIMESHEET_GROUPS, timesheetCsv, type TimesheetGroup } from "@/modules/timeclock/timesheet-export";
import { timesheets } from "@/modules/timeclock/timesheet-service";

/**
 * Everybody's hours from `?from=` to `?to=` (days on the company's calendar,
 * inclusive, at most a quarter), by day or by person (`?group=`), for payroll.
 * `timeclock.export`, the permission that takes pay out, with
 * `timeclock.read.all`: the file is everybody's or it is no use to whoever
 * pays them.
 */
export async function GET(request: Request) {
  const ctx = await getCompanyContext();
  if (!ctx) return new NextResponse(null, { status: 401 });
  if (!ctx.permissions.has("timeclock.export") || !ctx.permissions.has("timeclock.read.all")) {
    return new NextResponse(null, { status: 403 });
  }

  const search = new URL(request.url).searchParams;
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";
  const group = (search.get("group") ?? "day") as TimesheetGroup;
  const t = await getTranslations("timesheets.export");
  if (!isDay(from) || !isDay(to) || to < from || addDays(from, MAX_EXPORT_DAYS - 1) < to || !TIMESHEET_GROUPS.includes(group)) {
    // Reached from a plain form, so the browser shows this body: a sentence, not an empty page.
    return new NextResponse(t("invalidRange", { days: MAX_EXPORT_DAYS }), {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const people = await timesheets(ctx, from, to);
  const csv = timesheetCsv(people, group, ctx.company.timezone, {
    column: (column) => t(`columns.${column}`, { currency: ctx.company.currency }),
    openShifts: (count) => t("openShifts", { count }),
    correctedShifts: (count) => t("correctedShifts", { count }),
    mealAdjusted: (minutes, reason) => t("mealAdjusted", { minutes, reason }),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ctx.company.slug}-hours-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
