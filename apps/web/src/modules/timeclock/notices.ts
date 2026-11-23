import { prisma } from "@/lib/db/prisma";
import { MembershipStatus, NotificationKind, TimeEntryEnd, TimeEntryKind } from "@/generated/prisma/enums";
import { LEFT_OPEN_AFTER_MS } from "@nodo/core/timeclock/punch";
import { wallClock } from "@nodo/core/zoned-time";
import { notify } from "@/modules/notifications/inbox";

type Raise = (notice: Omit<Parameters<typeof notify>[0], "kind">) => Promise<boolean>;

/**
 * What the clock tells people about a shift: the person whose shift it is —
 * their phone may have told them already, and this is the record — and
 * whoever reads everybody's hours (`timeclock.read.all`), who is the one to
 * ring them or put the shift right. Once per shift (`dedupeKey`), whatever
 * the clock does to it afterwards. Each caller raises its own kind, so the
 * bell's coverage test finds it written out.
 */
async function tellAboutShift(
  entryId: string,
  key: string,
  raise: Raise,
  params: (entry: { jobName: string; clockInAt: Date; clockOutAt: Date | null; endedBy: TimeEntryEnd | null; timezone: string }) => Record<string, string | number> | null,
): Promise<number> {
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      companyId: true,
      userId: true,
      jobName: true,
      clockInAt: true,
      clockOutAt: true,
      endedBy: true,
      user: { select: { name: true, email: true } },
      company: { select: { timezone: true } },
    },
  });
  if (!entry) return 0;
  const own = params({ ...entry, timezone: entry.company.timezone });
  if (!own) return 0;

  const supervisors = await prisma.membership.findMany({
    where: {
      companyId: entry.companyId,
      status: MembershipStatus.ACTIVE,
      role: { permissions: { some: { permission: { key: "timeclock.read.all" } } } },
    },
    select: { userId: true },
  });

  let raised = 0;
  for (const userId of new Set([entry.userId, ...supervisors.map((member) => member.userId)])) {
    const fresh = await raise({
      companyId: entry.companyId,
      userId,
      params: { person: entry.user.name ?? entry.user.email, ...own, self: userId === entry.userId ? "yes" : "no" },
      href: `/timesheets/${entry.userId}/shifts/${entry.id}`,
      dedupeKey: `${key}:${entry.id}`,
    });
    if (fresh) raised++;
  }
  return raised;
}

/**
 * The clock ended somebody's shift by itself: away from the job longer than
 * the company allows, or travel that ran past its limit. The time is the
 * company's wall clock, as a token.
 */
export async function notifyAutoClockOut(entryId: string): Promise<void> {
  const raise: Raise = (notice) => {
    return notify({ ...notice, kind: NotificationKind.TIMECLOCK_AUTO_OUT });
  };
  await tellAboutShift(entryId, "timeclock-auto-out", raise, (entry) =>
    entry.clockOutAt
      ? {
          job: entry.jobName,
          time: wallClock(entry.clockOutAt, entry.timezone).time,
          why: entry.endedBy === TimeEntryEnd.TRAVEL_LIMIT ? "travel" : "left",
        }
      : null,
  );
}

/**
 * Shifts on a job still open long after anybody works one
 * (`LEFT_OPEN_AFTER_MS`): somebody forgot to clock out, and until they or a
 * supervisor end it the day counts nothing. Travel isn't asked about — it
 * ends by itself. For the sweep and the clock's cron, so it walks every
 * company through `prisma`; returns how many shifts were raised.
 */
export async function notifyLeftOpen(now = new Date()): Promise<number> {
  const open = await prisma.timeEntry.findMany({
    where: {
      clockOutAt: null,
      kind: TimeEntryKind.WORK,
      clockInAt: { lte: new Date(now.getTime() - LEFT_OPEN_AFTER_MS) },
      company: { isActive: true },
    },
    select: { id: true },
    orderBy: { clockInAt: "asc" },
    take: 500,
  });
  const raise: Raise = (notice) => {
    return notify({ ...notice, kind: NotificationKind.TIMECLOCK_LEFT_OPEN });
  };
  let raised = 0;
  for (const { id } of open) {
    const told = await tellAboutShift(id, "timeclock-left-open", raise, (entry) =>
      entry.clockOutAt ? null : { job: entry.jobName, hours: Math.floor((now.getTime() - entry.clockInAt.getTime()) / 3_600_000) },
    );
    if (told > 0) raised++;
  }
  return raised;
}
