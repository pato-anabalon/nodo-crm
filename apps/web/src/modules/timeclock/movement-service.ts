import { Prisma, TimeEntryEnd, TimeEntryEventKind, TimeEntryKind, TimeEntrySource } from "@/generated/prisma/client";
import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { asPoint, type Fix } from "@nodo/core/timeclock/geofence";
import { siteState } from "@nodo/core/timeclock/movement";
import { clockInRefusal, punchTimeProblem } from "@nodo/core/timeclock/punch";
import { TimeclockRefusal } from "./errors";
import { byClientId, consentOf, entrySelect, entryView, openEntry, type EntryView } from "./service";
import { settleEntry } from "./settle";

/**
 * Moving during a shift: what the phone heard about the job's circle, the
 * errand somebody declares, travel to another job, and arriving at one
 * (`@nodo/core/timeclock/movement` for the rules). Every call carries the
 * phone's own ids, as a punch does, so a queue sent twice changes nothing
 * the second time; and each settles the shift first, so a decision the clock
 * already took is what the phone is answered with.
 */

export type SiteEventInput = { clientId: string; kind: TimeEntryEventKind; at: Date; note?: string | null };

async function ownEntry(ctx: CompanyContext, clientId: string) {
  const entry = await ctx.db.timeEntry.findFirst({
    where: { clientId, userId: ctx.user.id },
    select: { id: true, kind: true, jobId: true, jobName: true, clockInAt: true, clockOutAt: true, endedBy: true, editedAt: true },
  });
  if (!entry) throw new TimeclockRefusal("not_found", false);
  return entry;
}

/**
 * Events for a shift on a job. Kept: what happened during the shift, and —
 * for a shift the clock closed by itself — afterwards too, because a return
 * dated in time is what reopens it. Dropped: anything on a shift a person
 * ended, past its end, or with a time no punch would be allowed.
 */
export async function recordSiteEvents(
  ctx: CompanyContext,
  entryClientId: string,
  events: readonly SiteEventInput[],
  now = new Date(),
): Promise<{ stored: number; open: Awaited<ReturnType<typeof openEntry>> }> {
  const entry = await ownEntry(ctx, entryClientId);
  if (entry.kind !== TimeEntryKind.WORK) throw new TimeclockRefusal("not_on_a_job", false);

  const byClock = entry.endedBy === TimeEntryEnd.LEFT_SITE && entry.editedAt === null;
  const kept = events.filter(
    (event) =>
      !punchTimeProblem(event.at, now) &&
      event.at >= entry.clockInAt &&
      (entry.clockOutAt === null || byClock || event.at <= entry.clockOutAt),
  );
  const { count } = await ctx.db.timeEntryEvent.createMany({
    data: kept.map((event) => ({
      companyId: ctx.company.id,
      timeEntryId: entry.id,
      kind: event.kind,
      clientId: event.clientId,
      at: event.at,
      receivedAt: now,
      note: event.kind === TimeEntryEventKind.ERRAND ? (event.note?.trim() || null) : null,
    })),
    skipDuplicates: true,
  });
  if (count > 0) await settleEntry(ctx.company.id, entry.id, ctx.company.movementPolicy, now);
  return { stored: count, open: await openEntry(ctx, now) };
}

export type TravelInput = { entryClientId: string; clientId: string; at: Date };

/**
 * "I'm going to another job": the shift on this one ends at the moment they
 * left it, and travel starts there, paid and on no job, until they arrive
 * somewhere (`switchSite`) or it runs out. Taken also when the clock already
 * ended the shift for being away — somebody who answers the notice from the
 * road is still on their way to work — and then it starts where that ended.
 */
export async function startTravel(ctx: CompanyContext, input: TravelInput, now = new Date()): Promise<{ entry: EntryView; created: boolean }> {
  const again = await byClientId(ctx, input.clientId);
  if (again) return { entry: again, created: false };
  const timeProblem = punchTimeProblem(input.at, now);
  if (timeProblem) throw new TimeclockRefusal(timeProblem, false);

  const from = await ownEntry(ctx, input.entryClientId);
  if (from.kind !== TimeEntryKind.WORK) throw new TimeclockRefusal("not_on_a_job", false);
  if (!from.clockOutAt) await settleEntry(ctx.company.id, from.id, ctx.company.movementPolicy, now);
  const current = await ownEntry(ctx, input.entryClientId);

  let startsAt: Date;
  if (!current.clockOutAt) {
    const events = await ctx.db.timeEntryEvent.findMany({ where: { timeEntryId: current.id }, select: { kind: true, at: true } });
    startsAt = siteState(events, ctx.company.movementPolicy, now).leftAt ?? input.at;
  } else if (current.endedBy === TimeEntryEnd.LEFT_SITE && current.editedAt === null) {
    startsAt = current.clockOutAt;
  } else {
    throw new TimeclockRefusal("already_ended", true);
  }
  if (startsAt < current.clockInAt) throw new TimeclockRefusal("clock_out_before_in", false);

  const entry = await createAfter(ctx, { id: current.id, open: !current.clockOutAt }, startsAt, now, {
    kind: TimeEntryKind.TRAVEL,
    jobId: null,
    jobName: current.jobName,
    clientId: input.clientId,
    clockInAt: startsAt,
  });
  return { entry, created: true };
}

export type SwitchInput = { fromClientId: string; clientId: string; at: Date; fix: Fix; battery?: number | null };

/**
 * Arriving at another job and taking it up, in one press: whatever is open —
 * the shift on the last job or the travel since — ends now and the shift here
 * starts now. Held to everything a clock-in is: consent, inside the circle, a
 * time the clock allows. When the clock already ended what was open, this is
 * a clock-in, after it.
 */
export async function switchSite(
  ctx: CompanyContext,
  job: { id: string; name: string },
  input: SwitchInput,
  now = new Date(),
): Promise<{ entry: EntryView; created: boolean }> {
  const again = await byClientId(ctx, input.clientId);
  if (again) return { entry: again, created: false };
  const timeProblem = punchTimeProblem(input.at, now);
  if (timeProblem) throw new TimeclockRefusal(timeProblem, false);
  if (!(await consentOf(ctx))) throw new TimeclockRefusal("consent_required", true);

  const site = await ctx.db.job.findFirst({ where: { id: job.id }, select: { latitude: true, longitude: true, geofenceRadiusM: true } });
  const radiusM = site?.geofenceRadiusM ?? 0;
  const answer = clockInRefusal(asPoint(site?.latitude, site?.longitude), radiusM, input.fix);
  if (answer.refusal) {
    const extra = answer.distanceM === undefined ? {} : { distanceM: Math.round(answer.distanceM), radiusM };
    throw new TimeclockRefusal(answer.refusal, false, extra);
  }

  const from = await ownEntry(ctx, input.fromClientId);
  if (!from.clockOutAt) await settleEntry(ctx.company.id, from.id, ctx.company.movementPolicy, now);
  const current = await ownEntry(ctx, input.fromClientId);
  if (!current.clockOutAt && current.kind === TimeEntryKind.WORK && current.jobId === job.id) {
    throw new TimeclockRefusal("same_job", true);
  }
  if (input.at < (current.clockOutAt ?? current.clockInAt)) throw new TimeclockRefusal("clock_out_before_in", false);

  const entry = await createAfter(ctx, current.clockOutAt ? null : { id: current.id, open: true }, input.at, now, {
    kind: TimeEntryKind.WORK,
    jobId: job.id,
    jobName: job.name,
    clientId: input.clientId,
    clockInAt: input.at,
    clockInLatitude: input.fix.latitude,
    clockInLongitude: input.fix.longitude,
    clockInAccuracyM: input.fix.accuracyM,
    clockInDistanceM: answer.distanceM,
    clockInBattery: input.battery ?? null,
  });
  return { entry, created: true };
}

type NextStretch = Omit<Prisma.TimeEntryUncheckedCreateInput, "companyId" | "userId" | "source" | "clockInReceivedAt">;

/**
 * Ends what came before at `at` and starts the next stretch, in one
 * transaction: nobody is ever on two at once, nor on none between them. One
 * the clock had already closed keeps its end and is marked as switched from,
 * so a late return can no longer reopen it under the travel that followed. A
 * shift opened elsewhere in between is the one-open-shift index's refusal.
 */
async function createAfter(
  ctx: CompanyContext,
  close: { id: string; open: boolean } | null,
  at: Date,
  now: Date,
  next: NextStretch,
): Promise<EntryView> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      if (close) {
        const { count } = await tx.timeEntry.updateMany({
          where: close.open
            ? { id: close.id, companyId: ctx.company.id, clockOutAt: null }
            : { id: close.id, companyId: ctx.company.id, endedBy: TimeEntryEnd.LEFT_SITE, editedAt: null },
          data: close.open ? { clockOutAt: at, clockOutReceivedAt: now, endedBy: TimeEntryEnd.SWITCHED } : { endedBy: TimeEntryEnd.SWITCHED },
        });
        if (count === 0) throw new TimeclockRefusal("already_ended", true);
      }
      return tx.timeEntry.create({
        data: { ...next, companyId: ctx.company.id, userId: ctx.user.id, source: TimeEntrySource.MOBILE, clockInReceivedAt: now },
        select: entrySelect,
      });
    });
    return entryView(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await byClientId(ctx, String(next.clientId));
      if (raced) return raced;
      const open = await openEntry(ctx, now);
      if (open) throw new TimeclockRefusal("already_clocked_in", true, { entry: open });
      throw new TimeclockRefusal("client_id_taken", true);
    }
    throw error;
  }
}
