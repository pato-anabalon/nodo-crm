import { prisma } from "@/lib/db/prisma";
import { decodeTrack, thinTrack } from "@nodo/core/timeclock/track";

/** Shifts thinned per company per night: a backlog clears over a few nights instead of in one long run. */
const SHIFTS_PER_RUN = 300;

/**
 * Positions are kept for the company's `locationRetentionDays` and then
 * thinned: a shift that began longer ago than that keeps its track as one
 * simplified line (`TimeEntry.track`) and its positions are deleted, in one
 * transaction. The punches themselves are never touched — they are what the
 * pay is worked out from. An open shift is left alone, however old.
 *
 * For the daily sweep, which has no session: through `prisma`, with the
 * company named. Returns how many shifts were thinned.
 */
export async function thinOldTracks(company: { id: string; locationRetentionDays: number }, now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - company.locationRetentionDays * 86_400_000);
  const entries = await prisma.timeEntry.findMany({
    where: { companyId: company.id, clockInAt: { lt: before }, clockOutAt: { not: null }, pings: { some: {} } },
    select: { id: true, track: true },
    orderBy: { clockInAt: "asc" },
    take: SHIFTS_PER_RUN,
  });

  for (const entry of entries) {
    const pings = await prisma.locationPing.findMany({
      where: { timeEntryId: entry.id },
      select: { latitude: true, longitude: true },
      orderBy: { recordedAt: "asc" },
    });
    // A line kept by an earlier run comes first: nothing recorded later can be from before it.
    const points = [...(entry.track ? decodeTrack(entry.track) : []), ...pings];
    await prisma.$transaction([
      prisma.timeEntry.update({ where: { id: entry.id }, data: { track: thinTrack(points) } }),
      prisma.locationPing.deleteMany({ where: { timeEntryId: entry.id } }),
    ]);
  }
  return entries.length;
}
