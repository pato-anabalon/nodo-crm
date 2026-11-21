import { prisma } from "@/lib/db/prisma";
import { MembershipStatus, NotificationKind, TimeEntryEnd } from "@/generated/prisma/enums";
import { wallClock } from "@nodo/core/zoned-time";
import { notify } from "@/modules/notifications/inbox";

/**
 * The clock ended somebody's shift by itself: away from the job longer than
 * the company allows, or travel that ran past its limit. The person hears it
 * — their phone may have told them already, and this is the record — and so
 * does whoever reads everybody's hours (`timeclock.read.all`), who is the one
 * to ring them or put the shift right.
 *
 * Once per shift (`dedupeKey`): a shift the clock reopens and closes again
 * doesn't say it twice. The time is the company's wall clock, as a token.
 */
export async function notifyAutoClockOut(entryId: string): Promise<void> {
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      companyId: true,
      userId: true,
      jobName: true,
      clockOutAt: true,
      endedBy: true,
      user: { select: { name: true, email: true } },
      company: { select: { timezone: true } },
    },
  });
  if (!entry?.clockOutAt) return;

  const supervisors = await prisma.membership.findMany({
    where: {
      companyId: entry.companyId,
      status: MembershipStatus.ACTIVE,
      role: { permissions: { some: { permission: { key: "timeclock.read.all" } } } },
    },
    select: { userId: true },
  });

  const params = {
    person: entry.user.name ?? entry.user.email,
    job: entry.jobName,
    time: wallClock(entry.clockOutAt, entry.company.timezone).time,
    why: entry.endedBy === TimeEntryEnd.TRAVEL_LIMIT ? "travel" : "left",
  };
  for (const userId of new Set([entry.userId, ...supervisors.map((member) => member.userId)])) {
    await notify({
      companyId: entry.companyId,
      userId,
      kind: NotificationKind.TIMECLOCK_AUTO_OUT,
      params: { ...params, self: userId === entry.userId ? "yes" : "no" },
      href: `/timesheets/${entry.userId}/shifts/${entry.id}`,
      dedupeKey: `timeclock-auto-out:${entry.id}`,
    });
  }
}
