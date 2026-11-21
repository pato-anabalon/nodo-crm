import { Prisma, TimeEntryEnd } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { settlement, type MovementPolicy } from "@nodo/core/timeclock/movement";
import { notifyAutoClockOut } from "./notices";

/**
 * What the clock does by itself: a shift whose person left the job and didn't
 * come back in time ends at the moment they left, travel ends at its limit, and
 * a shift it closed is reopened when the news that they were back in time
 * arrives late (`settlement`, in `@nodo/core/timeclock/movement`).
 *
 * Called before anything reads or punches a shift — the phone opening the
 * clock, a punch, an event — and by the sweep, so a shift ends even when the
 * phone that would have said so is flat. Goes through `prisma` with the
 * company named, because the sweep has no session; the callers that do have
 * one pass their own company.
 */

export type Settled = "closed" | "reopened" | null;

const policyOf = (company: { siteReturnMinutes: number; siteSwitchMinutes: number; travelMaxMinutes: number }): MovementPolicy => ({
  returnMinutes: company.siteReturnMinutes,
  switchMinutes: company.siteSwitchMinutes,
  travelMaxMinutes: company.travelMaxMinutes,
});

export async function settleEntry(companyId: string, entryId: string, policy: MovementPolicy, now = new Date()): Promise<Settled> {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, companyId },
    select: {
      id: true,
      userId: true,
      kind: true,
      clockInAt: true,
      clockOutAt: true,
      endedBy: true,
      editedAt: true,
      events: { select: { kind: true, at: true } },
    },
  });
  if (!entry) return null;

  const answer = settlement({ ...entry, edited: entry.editedAt !== null }, entry.events, policy, now);
  if (!answer) return null;

  if (answer.action === "close") {
    const wasOpen = entry.clockOutAt === null;
    const { count } = await prisma.timeEntry.updateMany({
      // Only what the clock may still move: open, or closed by the clock itself.
      where: { id: entry.id, companyId, editedAt: null, OR: [{ clockOutAt: null }, { endedBy: TimeEntryEnd.LEFT_SITE }] },
      data: {
        clockOutAt: answer.at,
        clockOutReceivedAt: now,
        endedBy: answer.endedBy,
        clockOutLatitude: null,
        clockOutLongitude: null,
        clockOutAccuracyM: null,
        clockOutDistanceM: null,
        clockOutInside: null,
        clockOutBattery: null,
      },
    });
    if (count === 0) return null;
    if (wasOpen) await notifyAutoClockOut(entry.id);
    return "closed";
  }

  // Reopening: only if nothing started since it closed, and the person has no
  // other shift open — the database's one-open-shift index says the second.
  const later = await prisma.timeEntry.findFirst({
    where: { companyId, userId: entry.userId, id: { not: entry.id }, clockInAt: { gte: entry.clockOutAt! } },
    select: { id: true },
  });
  if (later) return null;
  try {
    const { count } = await prisma.timeEntry.updateMany({
      where: { id: entry.id, companyId, editedAt: null, endedBy: TimeEntryEnd.LEFT_SITE },
      data: { clockOutAt: null, clockOutReceivedAt: null, endedBy: null },
    });
    return count > 0 ? "reopened" : null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

/**
 * Every open shift in every company that has something to settle — a
 * countdown or travel — for the sweep. Returns how many it closed.
 */
export async function settleOpenEntries(now = new Date()): Promise<number> {
  const open = await prisma.timeEntry.findMany({
    where: {
      clockOutAt: null,
      company: { isActive: true },
      OR: [{ kind: "TRAVEL" }, { events: { some: { kind: "LEFT" } }, company: { siteReturnMinutes: { gt: 0 } } }],
    },
    select: { id: true, companyId: true, company: { select: { siteReturnMinutes: true, siteSwitchMinutes: true, travelMaxMinutes: true } } },
  });
  let closed = 0;
  for (const entry of open) {
    if ((await settleEntry(entry.companyId, entry.id, policyOf(entry.company), now)) === "closed") closed++;
  }
  return closed;
}
