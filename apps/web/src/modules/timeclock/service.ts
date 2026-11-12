import { JobStatus, Prisma, TimeEntrySource } from "@/generated/prisma/client";
import type { CompanyContext } from "@/lib/auth/session";
import { asPoint, geofenceVerdict, type Fix } from "@nodo/core/timeclock/geofence";
import { clockInRefusal, isLatePunch, punchTimeProblem, withinShift } from "@nodo/core/timeclock/punch";
import { jobVisibilityWhere } from "@/modules/jobs/scope";
import { TimeclockRefusal } from "./errors";

/**
 * The clock: shifts clocked in on site and out wherever the day ends, and the
 * positions recorded in between. Every punch is the phone's own — its time,
 * its fix, its id — checked again here, so the phone's answer is never the
 * only one. Sending a punch twice finds what the first one made.
 */

const entrySelect = {
  id: true,
  clientId: true,
  jobId: true,
  jobName: true,
  source: true,
  clockInAt: true,
  clockInReceivedAt: true,
  clockInDistanceM: true,
  clockOutAt: true,
  clockOutReceivedAt: true,
  clockOutInside: true,
  note: true,
  editedAt: true,
} satisfies Prisma.TimeEntrySelect;

type EntryRow = Prisma.TimeEntryGetPayload<{ select: typeof entrySelect }>;

/** A shift as the app reads it: instants as ISO, and whether each punch arrived late. */
export function entryView(row: EntryRow) {
  return {
    id: row.id,
    clientId: row.clientId,
    job: { id: row.jobId, name: row.jobName },
    source: row.source,
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt?.toISOString() ?? null,
    clockInDistanceM: row.clockInDistanceM === null ? null : Math.round(row.clockInDistanceM),
    clockOutInside: row.clockOutInside,
    clockInLate: isLatePunch(row.clockInAt, row.clockInReceivedAt),
    clockOutLate: row.clockOutAt && row.clockOutReceivedAt ? isLatePunch(row.clockOutAt, row.clockOutReceivedAt) : false,
    note: row.note,
    edited: row.editedAt !== null,
  };
}

export type EntryView = ReturnType<typeof entryView>;

export async function consentOf(ctx: CompanyContext): Promise<Date | null> {
  const membership = await ctx.db.membership.findFirst({ where: { userId: ctx.user.id }, select: { locationConsentAt: true } });
  return membership?.locationConsentAt ?? null;
}

/**
 * Agreeing to the position being recorded during shifts, or taking it back.
 * Taking it back while clocked in is refused: the shift would go on with a
 * track that stopped, and ending it first is one press.
 */
export async function setConsent(ctx: CompanyContext, consent: boolean): Promise<Date | null> {
  if (!consent && (await openEntry(ctx))) throw new TimeclockRefusal("clocked_in", true);
  const current = await consentOf(ctx);
  // Agreeing again keeps the first date: it is when they agreed, not when the app last asked.
  const value = consent ? (current ?? new Date()) : null;
  await ctx.db.membership.updateMany({ where: { userId: ctx.user.id }, data: { locationConsentAt: value } });
  return value;
}

export async function openEntry(ctx: CompanyContext): Promise<EntryView | null> {
  const row = await ctx.db.timeEntry.findFirst({ where: { userId: ctx.user.id, clockOutAt: null }, select: entrySelect });
  return row ? entryView(row) : null;
}

/** The jobs this person can clock into: the ones they can see that aren't finished, with where each is. */
export async function clockableJobs(ctx: CompanyContext) {
  const jobs = await ctx.db.job.findMany({
    // The one status `isJobClosed` locks: a finished job can't be clocked into.
    where: { ...jobVisibilityWhere(ctx.user.id, ctx.permissions), status: { not: JobStatus.COMPLETED } },
    select: { id: true, name: true, address: true, latitude: true, longitude: true, geofenceRadiusM: true },
    orderBy: { name: "asc" },
  });
  return jobs.map((job) => {
    const site = asPoint(job.latitude, job.longitude);
    return { id: job.id, name: job.name, address: job.address, site: site ? { ...site, radiusM: job.geofenceRadiusM } : null };
  });
}

export type ClockInInput = { clientId: string; at: Date; fix: Fix; battery?: number | null };

/**
 * Clocks in on a job the caller has already checked this person may punch on
 * (`jobContextFor` with `timeclock.punch`). In order: a punch already received
 * is answered with what it made; then the time, the consent, the place and the
 * shift already open, each its own refusal.
 */
export async function clockIn(
  ctx: CompanyContext,
  job: { id: string; name: string },
  input: ClockInInput,
  now = new Date(),
): Promise<{ entry: EntryView; created: boolean }> {
  const again = await byClientId(ctx, input.clientId);
  if (again) return { entry: again, created: false };

  const timeProblem = punchTimeProblem(input.at, now);
  if (timeProblem) throw new TimeclockRefusal(timeProblem, false);
  if (!(await consentOf(ctx))) throw new TimeclockRefusal("consent_required", true);

  const site = await ctx.db.job.findFirst({
    where: { id: job.id },
    select: { latitude: true, longitude: true, geofenceRadiusM: true },
  });
  const radiusM = site?.geofenceRadiusM ?? 0;
  const answer = clockInRefusal(asPoint(site?.latitude, site?.longitude), radiusM, input.fix);
  if (answer.refusal) {
    const extra = answer.distanceM === undefined ? {} : { distanceM: Math.round(answer.distanceM), radiusM };
    throw new TimeclockRefusal(answer.refusal, false, extra);
  }

  const open = await openEntry(ctx);
  if (open) throw new TimeclockRefusal("already_clocked_in", true, { entry: open });

  try {
    const row = await ctx.db.timeEntry.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        jobId: job.id,
        jobName: job.name,
        source: TimeEntrySource.MOBILE,
        clientId: input.clientId,
        clockInAt: input.at,
        clockInReceivedAt: now,
        clockInLatitude: input.fix.latitude,
        clockInLongitude: input.fix.longitude,
        clockInAccuracyM: input.fix.accuracyM,
        clockInDistanceM: answer.distanceM,
        clockInBattery: input.battery ?? null,
      },
      select: entrySelect,
    });
    return { entry: entryView(row), created: true };
  } catch (error) {
    // Two presses racing each other: one wins, and the other finds what it made.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await byClientId(ctx, input.clientId);
      if (raced) return { entry: raced, created: false };
      const open = await openEntry(ctx);
      if (open) throw new TimeclockRefusal("already_clocked_in", true, { entry: open });
      // The id is somebody else's: a phone can't use another's punch to find it.
      throw new TimeclockRefusal("client_id_taken", true);
    }
    throw error;
  }
}

export type ClockOutInput = { entryClientId: string; at: Date; fix?: Fix | null; battery?: number | null };

/**
 * Ends the shift the phone clocked in with. Taken anywhere — where it happened
 * is recorded, not judged — and taken once: a shift already ended is answered
 * as it is, so a retry can't move its end.
 */
export async function clockOut(
  ctx: CompanyContext,
  input: ClockOutInput,
  now = new Date(),
): Promise<{ entry: EntryView; changed: boolean }> {
  const entry = await ctx.db.timeEntry.findFirst({
    where: { clientId: input.entryClientId, userId: ctx.user.id },
    select: { ...entrySelect, job: { select: { latitude: true, longitude: true, geofenceRadiusM: true } } },
  });
  if (!entry) throw new TimeclockRefusal("not_found", false);
  if (entry.clockOutAt) return { entry: entryView(entry), changed: false };

  const timeProblem = punchTimeProblem(input.at, now);
  if (timeProblem) throw new TimeclockRefusal(timeProblem, false);
  if (input.at < entry.clockInAt) throw new TimeclockRefusal("clock_out_before_in", false);

  let inside: boolean | null = null;
  let distanceM: number | null = null;
  if (input.fix && entry.job) {
    const verdict = geofenceVerdict(asPoint(entry.job.latitude, entry.job.longitude), entry.job.geofenceRadiusM, input.fix);
    if (verdict.kind !== "no-site") distanceM = verdict.distanceM;
    // A guess too vague to tell is neither: the timesheet says nothing rather than something wrong.
    if (verdict.kind === "inside" || verdict.kind === "outside") inside = verdict.kind === "inside";
  }

  const { count } = await ctx.db.timeEntry.updateMany({
    where: { id: entry.id, clockOutAt: null },
    data: {
      clockOutAt: input.at,
      clockOutReceivedAt: now,
      clockOutLatitude: input.fix?.latitude ?? null,
      clockOutLongitude: input.fix?.longitude ?? null,
      clockOutAccuracyM: input.fix?.accuracyM ?? null,
      clockOutDistanceM: distanceM,
      clockOutInside: inside,
      clockOutBattery: input.battery ?? null,
    },
  });
  const row = await ctx.db.timeEntry.findFirst({ where: { id: entry.id }, select: entrySelect });
  return { entry: entryView(row!), changed: count > 0 };
}

export type Ping = { at: Date; latitude: number; longitude: number; accuracyM: number; speedMps?: number | null };

/**
 * A batch of positions for one shift. Only what was recorded inside the shift
 * is kept, and a position already stored (same shift, same instant) is skipped,
 * so a batch sent again after a dropped answer stores nothing twice.
 */
export async function recordPings(
  ctx: CompanyContext,
  entryClientId: string,
  pings: readonly Ping[],
  now = new Date(),
): Promise<{ stored: number; outside: number }> {
  const entry = await ctx.db.timeEntry.findFirst({
    where: { clientId: entryClientId, userId: ctx.user.id },
    select: { id: true, clockInAt: true, clockOutAt: true },
  });
  if (!entry) throw new TimeclockRefusal("not_found", false);

  const kept = withinShift(pings, entry.clockInAt, entry.clockOutAt, now);
  const { count } = await ctx.db.locationPing.createMany({
    data: kept.map((ping) => ({
      companyId: ctx.company.id,
      timeEntryId: entry.id,
      recordedAt: ping.at,
      latitude: ping.latitude,
      longitude: ping.longitude,
      accuracyM: ping.accuracyM,
      speedMps: ping.speedMps ?? null,
    })),
    skipDuplicates: true,
  });
  return { stored: count, outside: pings.length - kept.length };
}

/** This person's own shifts that started in the window, newest first. */
export async function ownEntries(ctx: CompanyContext, from: Date, to: Date): Promise<EntryView[]> {
  const rows = await ctx.db.timeEntry.findMany({
    where: { userId: ctx.user.id, clockInAt: { gte: from, lt: to } },
    select: entrySelect,
    orderBy: { clockInAt: "desc" },
  });
  return rows.map(entryView);
}

async function byClientId(ctx: CompanyContext, clientId: string): Promise<EntryView | null> {
  const row = await ctx.db.timeEntry.findFirst({ where: { clientId, userId: ctx.user.id }, select: entrySelect });
  return row ? entryView(row) : null;
}
