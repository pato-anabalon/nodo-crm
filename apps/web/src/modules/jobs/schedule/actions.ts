"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Permission } from "@/lib/auth/permissions";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { requireJobContext } from "../access";
import type { JobActionState } from "../actions";
import { commentSchema, idsFrom, parseUploads } from "../board/schemas";
import { eventFromForm } from "./schemas";
import { createEvent, createEventComment, deleteEvent, findEvent, updateEvent } from "./service";

/**
 * Events have no owner the way posts do: `schedule.update` and
 * `schedule.delete` reach any event on a job the person is on. The guard
 * reads the job off the row and asks for `schedule.read` as well.
 */

function refresh(jobId: string, eventId?: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/schedule`);
  if (eventId) revalidatePath(`/jobs/${jobId}/schedule/${eventId}`);
  revalidatePath("/lineup");
}

async function eventGuard(eventId: string, permission: Permission) {
  const base = await requireCompanyContext();
  const event = await findEvent(base, eventId);
  if (!event) return null;
  const { ctx } = await requireJobContext(event.jobId, permission);
  return can(ctx, "schedule.read") ? { ctx, event } : null;
}

export async function createEventAction(jobId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const { ctx, job } = await requireJobContext(jobId, "schedule.create");
  const t = await getTranslations();
  if (!can(ctx, "schedule.read")) return { error: t("jobs.schedule.notAllowed") };

  const parsed = eventFromForm(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const eventId = await createEvent(ctx, job.id, parsed.data, idsFrom(formData.getAll("participantId")));
  refresh(job.id);
  redirect(`/jobs/${job.id}/schedule/${eventId}`);
}

export async function updateEventAction(eventId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await eventGuard(eventId, "schedule.update");
  if (!guarded) return { error: t("jobs.schedule.notAllowed") };

  const parsed = eventFromForm(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  await updateEvent(guarded.ctx, guarded.event, parsed.data, idsFrom(formData.getAll("participantId")));
  refresh(guarded.event.jobId, eventId);
  redirect(`/jobs/${guarded.event.jobId}/schedule/${eventId}`);
}

export async function deleteEventAction(eventId: string): Promise<JobActionState> {
  const t = await getTranslations("jobs.schedule");
  const guarded = await eventGuard(eventId, "schedule.delete");
  if (!guarded) return { error: t("notAllowed") };

  await deleteEvent(guarded.ctx, guarded.event.jobId, eventId);
  refresh(guarded.event.jobId);
  redirect(`/jobs/${guarded.event.jobId}/schedule`);
}

export async function createEventCommentAction(eventId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await eventGuard(eventId, "comments.create");
  if (!guarded) return { error: t("jobs.schedule.notAllowed") };

  const parsed = commentSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await createEventComment(guarded.ctx, guarded.event, parsed.data.body, parseUploads(formData.get("attachments")));
  if (!outcome.ok) return { error: t(outcome.reason === "empty" ? "jobs.board.commentEmpty" : "jobs.board.filesRefused") };

  refresh(guarded.event.jobId, eventId);
  return { message: t("jobs.board.commented") };
}
