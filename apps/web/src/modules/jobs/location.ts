import { JobLocationSource } from "@/generated/prisma/enums";
import type { CompanyContext } from "@/lib/auth/session";
import { geocode } from "@/lib/geo/geocode";
import type { Point } from "@nodo/core/timeclock/geofence";

/**
 * A job's place on the map. Read from its address whenever the address
 * changes — creating it, editing it, a quote's address arriving — unless a
 * person put the pin there by hand, which only a person moves again.
 */

type Located = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: JobLocationSource | null;
  geocodedAddress: string | null;
};

/** Spacing and case don't make a different address. */
const same = (a: string | null, b: string | null) =>
  (a ?? "").trim().replace(/\s+/g, " ").toLowerCase() === (b ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export type LocationPlan = "keep" | "geocode" | "clear";

/**
 * What saving the job's address means for its pin. A hand-placed pin stays
 * whatever the address does; one read from the address follows it, and goes
 * when the address is emptied — a pin for an address nobody has is a guess.
 */
export function locationPlan(job: Located): LocationPlan {
  if (job.locationSource === JobLocationSource.MANUAL) return "keep";
  if (!job.address?.trim()) return job.latitude !== null ? "clear" : "keep";
  if (job.locationSource === JobLocationSource.GEOCODED && same(job.address, job.geocodedAddress)) return "keep";
  // Asked once per address: one that found nothing isn't asked again until it changes.
  if (job.locationSource === null && same(job.address, job.geocodedAddress)) return "keep";
  return "geocode";
}

/** Whether the address has moved on since the pin was placed by hand — said on screen, never acted on. */
export function addressMovedSincePin(job: Located): boolean {
  return job.locationSource === JobLocationSource.MANUAL && !same(job.address, job.geocodedAddress);
}

const locatedSelect = {
  address: true,
  latitude: true,
  longitude: true,
  locationSource: true,
  geocodedAddress: true,
} as const;

/**
 * Brings the pin in line with the address, after a save. Never throws: a job
 * whose address can't be found is saved all the same, with no place.
 */
export async function syncJobLocation(ctx: CompanyContext, jobId: string): Promise<void> {
  const job = await ctx.db.job.findFirst({ where: { id: jobId }, select: locatedSelect });
  if (!job) return;
  const plan = locationPlan(job);
  if (plan === "keep") return;
  if (plan === "clear") {
    await ctx.db.job.update({ where: { id: jobId }, data: { ...noPlace, geocodedAddress: null } });
    return;
  }
  await placeFromAddress(ctx, jobId, job.address!);
}

const noPlace = { latitude: null, longitude: null, locationSource: null };

/** The address on the map, replacing whatever pin there was. False when nothing was found. */
export async function placeFromAddress(ctx: CompanyContext, jobId: string, address: string): Promise<boolean> {
  const point = await geocode(address, ctx.company.formatLocale);
  await ctx.db.job.update({
    where: { id: jobId },
    data: point
      ? { latitude: point.latitude, longitude: point.longitude, locationSource: JobLocationSource.GEOCODED, geocodedAddress: address }
      : // Remembered even when nothing was found, so the same address isn't asked about on every save.
        { ...noPlace, geocodedAddress: address },
  });
  return point !== null;
}

/** A pin put somewhere by a person, and the radius around it. */
export async function placeByHand(ctx: CompanyContext, jobId: string, point: Point, radiusM: number): Promise<void> {
  const job = await ctx.db.job.findFirst({ where: { id: jobId }, select: { address: true } });
  if (!job) return;
  await ctx.db.job.update({
    where: { id: jobId },
    data: {
      latitude: point.latitude,
      longitude: point.longitude,
      locationSource: JobLocationSource.MANUAL,
      // The address it was placed against, so the screen can say when the two drift apart.
      geocodedAddress: job.address,
      geofenceRadiusM: radiusM,
    },
  });
}

export async function setGeofenceRadius(ctx: CompanyContext, jobId: string, radiusM: number): Promise<void> {
  await ctx.db.job.update({ where: { id: jobId }, data: { geofenceRadiusM: radiusM } });
}

export async function clearJobLocation(ctx: CompanyContext, jobId: string): Promise<void> {
  const job = await ctx.db.job.findFirst({ where: { id: jobId }, select: { address: true } });
  if (!job) return;
  // Cleared on purpose: remembering the address keeps the next save from reading it straight back.
  await ctx.db.job.update({ where: { id: jobId }, data: { ...noPlace, geocodedAddress: job.address } });
}
