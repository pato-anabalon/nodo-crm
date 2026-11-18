import { Prisma, TimeEntrySource, TimesheetChangeKind } from "@/generated/prisma/client";
import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { wallClock } from "@nodo/core/zoned-time";
import { correctionProblem, snapshot, type Window } from "./corrections";
import { TimeclockRefusal } from "./errors";

/**
 * A supervisor's hand on somebody's hours (`timeclock.update`): a shift entered
 * for a phone that failed, a shift corrected — a clock-out forgotten, the
 * wrong job — or taken off, and the meal break of one day. Each leaves a
 * `TimesheetChange` with what it was, what it became, who and why, written in
 * the same transaction as the change itself: hours are pay, and a correction
 * nobody can trace is worse than the mistake it fixed.
 *
 * Nobody corrects their own hours. Checked here, not only hidden on screen.
 * The checks go through `ctx.db`, so a row of another company is not found;
 * the writes then name the company explicitly, inside one transaction.
 */

export type ShiftInput = { jobId: string; window: Window; reason: string };

/** The day a change is filed under: the day the shift starts, on the company's calendar. */
function dayOf(instant: Date, timeZone: string): Date {
  return new Date(`${wallClock(instant, timeZone).day}T00:00:00Z`);
}

async function guardPerson(ctx: CompanyContext, userId: string) {
  if (userId === ctx.user.id) throw new TimeclockRefusal("own_hours", false);
  const member = await ctx.db.membership.findFirst({ where: { userId }, select: { id: true } });
  if (!member) throw new TimeclockRefusal("not_found", false);
}

async function jobOf(ctx: CompanyContext, jobId: string) {
  const job = await ctx.db.job.findFirst({ where: { id: jobId }, select: { id: true, name: true } });
  if (!job) throw new TimeclockRefusal("job_not_found", false);
  return job;
}

/** The person's other shifts that could touch this one, held to the same rules a punch is. */
async function checkWindow(ctx: CompanyContext, userId: string, window: Window, now: Date, exceptId?: string) {
  const others = await ctx.db.timeEntry.findMany({
    where: {
      userId,
      ...(exceptId ? { id: { not: exceptId } } : {}),
      clockInAt: { lt: window.clockOutAt ?? now },
      OR: [{ clockOutAt: null }, { clockOutAt: { gt: window.clockInAt } }],
    },
    select: { clockInAt: true, clockOutAt: true },
  });
  const problem = correctionProblem(window, others, now);
  if (problem) throw new TimeclockRefusal(problem, problem === "overlaps");
}

/** Two open shifts for one person is the database's refusal too (`TimeEntry_one_open`). */
function openClash(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new TimeclockRefusal("overlaps", true);
  }
  throw error;
}

/** A shift entered by hand for somebody — a phone that died, a site with no signal all day. */
export async function addShift(ctx: CompanyContext, userId: string, input: ShiftInput, now = new Date()): Promise<string> {
  await guardPerson(ctx, userId);
  const job = await jobOf(ctx, input.jobId);
  await checkWindow(ctx, userId, input.window, now);

  try {
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.timeEntry.create({
        data: {
          companyId: ctx.company.id,
          userId,
          jobId: job.id,
          jobName: job.name,
          source: TimeEntrySource.MANUAL,
          clockInAt: input.window.clockInAt,
          clockInReceivedAt: now,
          clockOutAt: input.window.clockOutAt,
          clockOutReceivedAt: input.window.clockOutAt ? now : null,
          createdById: ctx.user.id,
        },
        select: { id: true },
      });
      await tx.timesheetChange.create({
        data: {
          companyId: ctx.company.id,
          userId,
          timeEntryId: entry.id,
          day: dayOf(input.window.clockInAt, ctx.company.timezone),
          kind: TimesheetChangeKind.SHIFT_ADDED,
          after: snapshot({ jobName: job.name, ...input.window }),
          reason: input.reason,
          authorId: ctx.user.id,
        },
      });
      return entry.id;
    });
  } catch (error) {
    openClash(error);
  }
}

async function entryToChange(ctx: CompanyContext, entryId: string) {
  const entry = await ctx.db.timeEntry.findFirst({
    where: { id: entryId },
    select: { id: true, userId: true, jobId: true, jobName: true, clockInAt: true, clockOutAt: true },
  });
  if (!entry) throw new TimeclockRefusal("not_found", false);
  await guardPerson(ctx, entry.userId);
  return entry;
}

/**
 * A shift put right: its job, when it started, when it ended. A shift that
 * ended can't be reopened from here — the phone would find itself clocked in
 * to a day long over — but an open one can be closed, which is what most
 * corrections will be: the clock-out somebody forgot.
 *
 * Changing the job takes its current name; keeping it keeps the name frozen
 * at clock-in, so a job renamed since doesn't rewrite the timesheet.
 */
export async function correctShift(ctx: CompanyContext, entryId: string, input: ShiftInput, now = new Date()): Promise<void> {
  const entry = await entryToChange(ctx, entryId);
  if (entry.clockOutAt && !input.window.clockOutAt) throw new TimeclockRefusal("reopen", false);
  const job = input.jobId === entry.jobId ? { id: entry.jobId, name: entry.jobName } : await jobOf(ctx, input.jobId);
  await checkWindow(ctx, entry.userId, input.window, now, entry.id);

  const before = snapshot(entry);
  const after = snapshot({ jobName: job.name, ...input.window });
  if (JSON.stringify(before) === JSON.stringify(after) && job.id === entry.jobId) return;

  try {
    await prisma.$transaction([
      prisma.timeEntry.update({
        where: { id: entry.id, companyId: ctx.company.id },
        data: {
          jobId: job.id,
          jobName: job.name,
          clockInAt: input.window.clockInAt,
          clockOutAt: input.window.clockOutAt,
          // A clock-out the phone never sent is received now, from a person.
          ...(input.window.clockOutAt && !entry.clockOutAt ? { clockOutReceivedAt: now } : {}),
          editedById: ctx.user.id,
          editedAt: now,
        },
      }),
      prisma.timesheetChange.create({
        data: {
          companyId: ctx.company.id,
          userId: entry.userId,
          timeEntryId: entry.id,
          day: dayOf(input.window.clockInAt, ctx.company.timezone),
          kind: TimesheetChangeKind.SHIFT_CORRECTED,
          before,
          after,
          reason: input.reason,
          authorId: ctx.user.id,
        },
      }),
    ]);
  } catch (error) {
    openClash(error);
  }
}

/**
 * A shift taken off — clocked in by mistake, entered twice. Its positions go
 * with it; its line in the change log stays, with what it was.
 */
export async function deleteShift(ctx: CompanyContext, entryId: string, reason: string): Promise<string> {
  const entry = await entryToChange(ctx, entryId);
  await prisma.$transaction([
    prisma.timesheetChange.create({
      data: {
        companyId: ctx.company.id,
        userId: entry.userId,
        timeEntryId: entry.id,
        day: dayOf(entry.clockInAt, ctx.company.timezone),
        kind: TimesheetChangeKind.SHIFT_DELETED,
        before: snapshot(entry),
        reason,
        authorId: ctx.user.id,
      },
    }),
    prisma.timeEntry.delete({ where: { id: entry.id, companyId: ctx.company.id } }),
  ]);
  return entry.userId;
}

/**
 * The meal break somebody actually took on a day, in place of the company's.
 * `minutes` null puts the day back on the company's policy.
 */
export async function adjustMeal(
  ctx: CompanyContext,
  userId: string,
  day: string,
  minutes: number | null,
  reason: string,
): Promise<void> {
  await guardPerson(ctx, userId);
  const date = new Date(`${day}T00:00:00Z`);
  const current = await ctx.db.timesheetDay.findFirst({ where: { userId, day: date }, select: { id: true, mealBreakMinutes: true } });
  if ((current?.mealBreakMinutes ?? null) === minutes) return;

  const key = { companyId_userId_day: { companyId: ctx.company.id, userId, day: date } };
  await prisma.$transaction([
    minutes === null
      ? prisma.timesheetDay.delete({ where: key })
      : prisma.timesheetDay.upsert({
          where: key,
          create: { companyId: ctx.company.id, userId, day: date, mealBreakMinutes: minutes, reason, editedById: ctx.user.id },
          update: { mealBreakMinutes: minutes, reason, editedById: ctx.user.id, editedAt: new Date() },
        }),
    prisma.timesheetChange.create({
      data: {
        companyId: ctx.company.id,
        userId,
        day: date,
        kind: TimesheetChangeKind.MEAL_ADJUSTED,
        before: { mealBreakMinutes: current?.mealBreakMinutes ?? null },
        after: { mealBreakMinutes: minutes },
        reason,
        authorId: ctx.user.id,
      },
    }),
  ]);
}

/** The jobs a shift can be put on: all of the company's, finished ones too — last week's hours may be on a job closed since. */
export async function shiftJobs(ctx: CompanyContext): Promise<{ id: string; name: string }[]> {
  return ctx.db.job.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
