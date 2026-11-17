import { addDays } from "@nodo/core/jobs/schedule/calendar";
import { zonedInstant } from "@nodo/core/zoned-time";
import { can, type CompanyContext } from "@/lib/auth/session";
import { personTimesheet, toShift, type PersonTimesheet } from "./timesheet";

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
  source: true,
  clockInAt: true,
  clockInReceivedAt: true,
  clockInDistanceM: true,
  clockOutAt: true,
  clockOutReceivedAt: true,
  clockOutInside: true,
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
      sheet: personTimesheet(membership.userId, shifts, from, to, ctx.company.breakPolicy),
    }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}
