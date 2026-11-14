import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { addDays, isDay } from "@nodo/core/jobs/schedule/calendar";
import { dayIn } from "@nodo/core/jobs/timeline";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { MAX_EXPORT_DAYS, TIMESHEET_GROUPS } from "@/modules/timeclock/timesheet-export";
import { weekFrom } from "@/modules/timeclock/week";

export async function generateMetadata() {
  const t = await getTranslations("timesheets.export");
  return { title: t("title") };
}

/**
 * Which days, and one row per day or per person. A plain form posting to the
 * file's own address: the browser downloads it and the page stays where it is.
 * It starts on last week, the one most often paid.
 */
export default async function ExportTimesheetsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requireCompanyContext();
  const [t, tSheets] = await Promise.all([getTranslations("timesheets.export"), getTranslations("timesheets")]);
  if (!can(ctx, "timeclock.export") || !can(ctx, "timeclock.read.all")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const query = await searchParams;
  const lastWeek = weekFrom(addDays(dayIn(new Date(), ctx.company.timezone), -7), "");
  const from = isDay(query.from) ? query.from : lastWeek.from;
  const to = isDay(query.to) ? query.to : lastWeek.to;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
          <Link href={`/timesheets?week=${from}`} aria-label={t("back", { section: tSheets("title") })}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardContent>
          <form action="/api/timesheets/export" method="get" className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">{t("from")}</Label>
              <Input id="from" name="from" type="date" defaultValue={from} required className="w-auto" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">{t("to")}</Label>
              <Input id="to" name="to" type="date" defaultValue={to} required className="w-auto" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group">{t("group")}</Label>
              <NativeSelect
                id="group"
                name="group"
                defaultValue="day"
                options={TIMESHEET_GROUPS.map((group) => ({ value: group, label: t(`groups.${group}`) }))}
              />
            </div>
            <Button type="submit">{t("download")}</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">{t("hint", { days: MAX_EXPORT_DAYS })}</p>
        </CardContent>
      </Card>
    </div>
  );
}
