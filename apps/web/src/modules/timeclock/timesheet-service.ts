import { addDays } from "@nodo/core/jobs/schedule/calendar";
import { zonedInstant } from "@nodo/core/zoned-time";
import { can, type CompanyContext } from "@/lib/auth/session";
import { personTimesheet, toShift, type MealAdjustment, type PersonTimesheet } from "./timesheet";

/**
 * The timesheet read from the database: shifts that started in a window of
 * days on the company's calendar, and the people they belong to. Everybody's
 * with `timeclock.read.all`; one's own otherwise.
 */

const shiftSelect = {
  id: true,
  userId: true,
  jobId: true,
  jobName: true,
  kind: true,
  source: true,
  clockInAt: true,
  clockInReceivedAt: true,
  clockInDistanceM: true,
  clockOutAt: true,
  clockOutReceivedAt: true,
  clockOutInside: true,
  endedBy: true,
  editedAt: true,
  note: true,
} as const;

export type TimesheetPerson = {
  userId: string;
  name: string | null;
  email: string;
  /** Only read for a profile with `timeclock.export`; null otherwise and when unset. */
  hourlyRate: number | null;
  sheet: PersonTimesheet;
};

/**
 * Every person with a shift in the window, by name. `userId` narrows it to
 * one; a profile without `timeclock.read.all` is narrowed to itself whatever
 * it asks for.
 */
export async function timesheets(
  ctx: CompanyContext,
  from: string,
  to: string,
  userId?: string,
): Promise<TimesheetPerson[]> {
  const zone = ctx.company.timezone;
  const only = can(ctx, "timeclock.read.all") ? userId : ctx.user.id;
  const rows = await ctx.db.timeEntry.findMany({
    where: {
      clockInAt: { gte: zonedInstant(from, "00:00", zone), lt: zonedInstant(addDays(to, 1), "00:00", zone) },
      ...(only ? { userId: only } : {}),
    },
    select: shiftSelect,
    orderBy: { clockInAt: "asc" },
  });
  const shifts = rows.map((row) => toShift(row, zone));
  const adjustments: MealAdjustment[] = (
    await ctx.db.timesheetDay.findMany({
      where: { day: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) }, ...(only ? { userId: only } : {}) },
      select: { userId: true, day: true, mealBreakMinutes: true, reason: true },
    })
  ).map((row) => ({ ...row, day: row.day.toISOString().slice(0, 10) }));

  const userIds = [...new Set(shifts.map((shift) => shift.userId))];
  if (only && !userIds.includes(only)) userIds.push(only);
  const seesRates = can(ctx, "timeclock.export");
  const memberships = await ctx.db.membership.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, hourlyRate: seesRates, user: { select: { name: true, email: true } } },
  });

  return memberships
    .map((membership) => ({
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      hourlyRate: seesRates && membership.hourlyRate !== null ? Number(membership.hourlyRate) : null,
      sheet: personTimesheet(membership.userId, shifts, from, to, ctx.company.breakPolicy, adjustments),
    }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

/**
 * One shift as its page shows it: the punches and where they were, the job's
 * circle, the positions recorded between them, and every change a person made
 * to it. Anybody's with `timeclock.read.all`; one's own with `timeclock.punch`.
 */
export async function shiftDetail(ctx: CompanyContext, entryId: string) {
  const entry = await ctx.db.timeEntry.findFirst({
    where: { id: entryId },
    select: {
      ...shiftSelect,
      clockInLatitude: true,
      clockInLongitude: true,
      clockOutLatitude: true,
      clockOutLongitude: true,
      clockOutDistanceM: true,
      track: true,
      createdBy: { select: { name: true, email: true } },
      editedBy: { select: { name: true, email: true } },
      job: { select: { latitude: true, longitude: true, geofenceRadiusM: true } },
      pings: { select: { latitude: true, longitude: true, recordedAt: true }, orderBy: { recordedAt: "asc" } },
      events: { select: { id: true, kind: true, at: true, note: true }, orderBy: { at: "asc" } },
      changes: {
        select: {
          id: true,
          kind: true,
          before: true,
          after: true,
          reason: true,
          createdAt: true,
          author: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!entry) return null;
  const own = entry.userId === ctx.user.id;
  if (!can(ctx, "timeclock.read.all") && !(own && can(ctx, "timeclock.punch"))) return null;
  return { ...entry, shift: toShift(entry, ctx.company.timezone) };
}

export type ShiftDetail = NonNullable<Awaited<ReturnType<typeof shiftDetail>>>;
