"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { asPoint, isGeofenceRadius, parseCoordinates } from "@nodo/core/timeclock/geofence";
import { requireJobContext } from "./access";
import type { JobActionState } from "./actions";
import { clearJobLocation, placeByHand, placeFromAddress, setGeofenceRadius } from "./location";

/**
 * Where the job is, behind `jobs.update` like the address it comes from. The
 * pin is the job's, not the clock's: whoever may fix the address may fix where
 * it sits on the map.
 */

/**
 * The radius, and — only when the pin was moved — where it now is: dragged
 * on the map (`latitude`/`longitude`) or pasted as text (`coordinates`). A
 * radius changed on its own leaves a pin read from the address as it was.
 */
export async function saveJobLocationAction(jobId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "jobs.update");
  const t = await getTranslations("jobs.location");

  const radius = Number(formData.get("radius"));
  if (!isGeofenceRadius(radius)) return { fieldErrors: { radius: [t("invalidRadius")] } };

  const typed = String(formData.get("coordinates") ?? "").trim();
  const dragged = formData.has("latitude") ? asPoint(formData.get("latitude"), formData.get("longitude")) : null;
  if (typed && !parseCoordinates(typed)) return { fieldErrors: { coordinates: [t("invalidCoordinates")] } };
  if (formData.has("latitude") && !dragged) return { error: t("invalidCoordinates") };
  const point = typed ? parseCoordinates(typed) : dragged;

  if (point) await placeByHand(ctx, jobId, point, radius);
  else await setGeofenceRadius(ctx, jobId, radius);
  revalidatePath(`/jobs/${jobId}`);
  return { message: t("saved") };
}

/** Back to the address: a hand-placed pin given up, or an address the first try didn't find. */
export async function placeJobFromAddressAction(jobId: string): Promise<JobActionState> {
  const { ctx, job } = await requireJobContext(jobId, "jobs.update");
  const t = await getTranslations("jobs.location");
  const row = await ctx.db.job.findFirst({ where: { id: job.id }, select: { address: true } });
  if (!row?.address?.trim()) return { error: t("noAddress") };

  const found = await placeFromAddress(ctx, jobId, row.address);
  revalidatePath(`/jobs/${jobId}`);
  return found ? { message: t("placedFromAddress") } : { error: t("notFound") };
}

export async function clearJobLocationAction(jobId: string): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "jobs.update");
  const t = await getTranslations("jobs.location");
  await clearJobLocation(ctx, jobId);
  revalidatePath(`/jobs/${jobId}`);
  return { message: t("cleared") };
}
