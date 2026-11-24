import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { asPoint } from "@nodo/core/timeclock/geofence";
import { decodeTrack } from "@nodo/core/timeclock/track";
import { wallClock } from "@nodo/core/zoned-time";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { correctShiftAction, deleteShiftAction } from "@/modules/timeclock/actions";
import { DeleteShiftForm, ShiftForm } from "@/modules/timeclock/correction-forms";
import { windowFields, type ShiftSnapshot } from "@/modules/timeclock/corrections";
import { shiftJobs } from "@/modules/timeclock/corrections-service";
import { ShiftMap } from "@/modules/timeclock/shift-map";
import { hoursAndMinutes, shiftFlags } from "@/modules/timeclock/timesheet";
import { shiftDetail, type ShiftDetail } from "@/modules/timeclock/timesheet-service";
import { dayTitle } from "@/modules/timeclock/week";

export async function generateMetadata() {
  const t = await getTranslations("timesheets");
  return { title: t("title") };
}

/**
 * One shift: where it was punched, the track in between, what it counts, and
 * every hand that changed it. Correcting and deleting it are `timeclock.update`,
 * on somebody else's shift only.
 */
export default async function ShiftPage({ params }: { params: Promise<{ userId: string; entryId: string }> }) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("timesheets");
  const { userId, entryId } = await params;
  const entry = await shiftDetail(ctx, entryId);
  if (!entry || entry.userId !== userId) notFound();

  const { timezone, formatLocale } = ctx.company;
  const { shift } = entry;
  const time = (instant: Date) => wallClock(instant, timezone).time;
  const range = shift.clockOutAt ? t("shift.range", { start: time(shift.clockInAt), end: time(shift.clockOutAt) }) : t("shift.since", { start: time(shift.clockInAt) });
  const canCorrect = can(ctx, "timeclock.update") && userId !== ctx.user.id;
  // Travel has no job to put right, only times: a wrong one is deleted and the day entered by hand.
  const canCorrectTimes = canCorrect && shift.kind === "WORK";
  const title = shift.kind === "TRAVEL" ? t("shift.travel", { job: shift.jobName }) : shift.jobName;
  const jobs = canCorrect ? await shiftJobs(ctx) : [];
  const site = entry.job ? asPoint(entry.job.latitude, entry.job.longitude) : null;
  const flags = shiftFlags(shift, (key) => t(`flags.${key}`));
  // Past the company's retention the positions are gone and the line kept on the shift stands in for them.
  const thinned = entry.pings.length === 0 && entry.track !== null;
  const track = thinned ? decodeTrack(entry.track!) : entry.pings;
  // A shift the clock ended keeps where they went until the countdown ran out (`trackEnd`).
  const afterEnd = shift.clockOutAt ? entry.pings.filter((ping) => ping.recordedAt > shift.clockOutAt!).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
          <Link href={`/timesheets/${userId}?week=${shift.day}`} aria-label={t("shiftPage.back")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {shift.jobId ? (
              <Link href={`/jobs/${shift.jobId}`} className="hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dayTitle(shift.day, formatLocale)} · <span className="tabular-nums">{range}</span>
            {shift.minutes !== null ? <> · <span className="tabular-nums">{hoursAndMinutes(shift.minutes)}</span></> : null}
          </p>
          {flags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {flags.map((flag) => (
                <Badge key={flag} variant="outline" className="font-normal">
                  {flag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("shiftPage.where")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {thinned
                ? t("shiftPage.trackThinned")
                : entry.pings.length > 0
                  ? t("shiftPage.trackCount", { count: entry.pings.length })
                  : t("shiftPage.noTrack")}
              {afterEnd > 0 ? <> {t("shiftPage.trackAfter", { count: afterEnd })}</> : null}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ShiftMap
              site={site && entry.job ? { ...site, radiusM: entry.job.geofenceRadiusM } : null}
              clockIn={asPoint(entry.clockInLatitude, entry.clockInLongitude)}
              clockOut={asPoint(entry.clockOutLatitude, entry.clockOutLongitude)}
              track={track}
            />
            <dl className="divide-y text-sm">
              <Punch label={t("shiftPage.clockIn")} value={time(shift.clockInAt)} detail={punchDetail(t, entry.clockInDistanceM, entry.source === "MANUAL")} />
              <Punch
                label={t("shiftPage.clockOut")}
                value={shift.clockOutAt ? time(shift.clockOutAt) : t("open")}
                detail={shift.clockOutAt ? clockOutDetail(t, shift.endedBy, entry.clockOutDistanceM, entry.clockOutLatitude === null) : null}
              />
            </dl>
            {entry.events.length > 0 ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium">{t("shiftPage.movement")}</p>
                <ol className="space-y-1 text-sm">
                  {entry.events.map((event) => (
                    <li key={event.id} className="flex flex-wrap justify-between gap-x-4">
                      <span>
                        {event.kind === "LEFT"
                          ? t("shiftPage.left")
                          : event.kind === "RETURNED"
                            ? t("shiftPage.returned")
                            : event.note
                              ? t("shiftPage.errandNote", { note: event.note })
                              : t("shiftPage.errand")}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{time(event.at)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("shiftPage.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            <History t={t} entry={entry} timezone={timezone} formatLocale={formatLocale} />
          </CardContent>
        </Card>
      </div>

      {canCorrect ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {canCorrectTimes ? (
            <Card className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("corrections.correctTitle")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("corrections.correctDescription")}</p>
              </CardHeader>
              <CardContent>
                <ShiftForm
                  action={correctShiftAction.bind(null, entry.id)}
                  jobs={shift.jobId && !jobs.some((job) => job.id === shift.jobId) ? [{ id: shift.jobId, name: shift.jobName }, ...jobs] : jobs}
                  defaults={{ jobId: shift.jobId ?? "", ...windowFields(shift, timezone) }}
                  openAllowed={shift.clockOutAt === null}
                  submitLabel={t("corrections.correct")}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card className="min-w-0 self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("corrections.deleteTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("corrections.deleteHint")}</p>
            </CardHeader>
            <CardContent>
              <DeleteShiftForm action={deleteShiftAction.bind(null, entry.id, shift.day)} shiftLabel={`${title}, ${dayTitle(shift.day, formatLocale)} ${range}`} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"timesheets">>>;

function punchDetail(t: T, distanceM: number | null, unknownPlace: boolean): string | null {
  if (distanceM !== null) return t("shiftPage.distance", { metres: Math.round(distanceM) });
  return unknownPlace ? t("shiftPage.noPlace") : null;
}

/** A shift the clock ended has no punch of its own to place: what it says is why it ended. */
function clockOutDetail(t: T, endedBy: ShiftDetail["shift"]["endedBy"], distanceM: number | null, unknownPlace: boolean): string | null {
  if (endedBy === "LEFT_SITE") return t("shiftPage.endedLeftSite");
  if (endedBy === "TRAVEL_LIMIT") return t("shiftPage.endedTravelLimit");
  return punchDetail(t, distanceM, unknownPlace);
}

function Punch({ label, value, detail }: { label: string; value: string; detail: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
      <dt className="font-medium">{label}</dt>
      <dd className="text-right">
        <span className="tabular-nums">{value}</span>
        {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
      </dd>
    </div>
  );
}

/**
 * What happened to the shift, newest first, ending with how it began: from
 * the phone, or entered by somebody. A change shows what it moved from and to.
 */
function History({ t, entry, timezone, formatLocale }: { t: T; entry: ShiftDetail; timezone: string; formatLocale: string }) {
  const when = (instant: Date) => new Intl.DateTimeFormat(formatLocale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(instant);
  const who = (person: { name: string | null; email: string } | null) => (person ? (person.name ?? person.email) : t("shiftPage.someone"));
  const describe = (shift: ShiftSnapshot | null) => {
    if (!shift) return "";
    const start = wallClock(new Date(shift.clockInAt), timezone);
    const end = shift.clockOutAt ? wallClock(new Date(shift.clockOutAt), timezone).time : t("open");
    return `${shift.jobName} · ${dayTitle(start.day, formatLocale)} ${start.time}–${end}`;
  };

  return (
    <ol className="space-y-4 text-sm">
      {entry.changes
        .filter((change) => change.kind === "SHIFT_CORRECTED")
        .map((change) => (
          <li key={change.id} className="space-y-1">
            <p>
              <span className="font-medium">{t("shiftPage.correctedBy", { person: who(change.author) })}</span>{" "}
              <span className="text-muted-foreground">· {when(change.createdAt)}</span>
            </p>
            <p className="text-muted-foreground">
              <span className="line-through">{describe(change.before as ShiftSnapshot | null)}</span>
              <br />
              {describe(change.after as ShiftSnapshot | null)}
            </p>
            <p className="italic">“{change.reason}”</p>
          </li>
        ))}
      <li className="space-y-1">
        <p>
          <span className="font-medium">
            {entry.source === "MANUAL" ? t("shiftPage.enteredBy", { person: who(entry.createdBy) }) : t("shiftPage.fromPhone")}
          </span>{" "}
          <span className="text-muted-foreground">· {when(entry.clockInReceivedAt)}</span>
        </p>
        {entry.changes
          .filter((change) => change.kind === "SHIFT_ADDED")
          .map((change) => (
            <p key={change.id} className="italic">
              “{change.reason}”
            </p>
          ))}
      </li>
    </ol>
  );
}
