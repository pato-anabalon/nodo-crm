"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { requireJobContext } from "./access";
import type { JobActionState } from "./actions";
import { addScopeItem, deleteScopeItem, scopeItemSchema, updateScopeItem } from "./scope-edits";

/**
 * Changing the scope takes `scope.update` and reading it `scope.read`: the
 * guard reads the job, refuses a finished one, and the line is looked for on
 * that job only.
 */
async function guard(jobId: string) {
  const { ctx, job } = await requireJobContext(jobId, "scope.update");
  return can(ctx, "scope.read") ? { ctx, job } : null;
}

function refresh(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/scope`);
}

function values(formData: FormData) {
  return scopeItemSchema.safeParse({ title: formData.get("title"), body: formData.get("body") ?? "" });
}

export async function addScopeItemAction(jobId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await guard(jobId);
  if (!guarded) return { error: t("jobs.scope.notAllowed") };

  const parsed = values(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  await addScopeItem(guarded.ctx, guarded.job.id, parsed.data);
  refresh(guarded.job.id);
  return { message: t("jobs.scope.added") };
}

export async function updateScopeItemAction(
  jobId: string,
  itemId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await guard(jobId);
  if (!guarded) return { error: t("jobs.scope.notAllowed") };

  const parsed = values(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  // Nothing changed, or the line is gone: either way the form is done with.
  await updateScopeItem(guarded.ctx, guarded.job.id, itemId, parsed.data);
  refresh(guarded.job.id);
  return { message: t("jobs.scope.saved") };
}

export async function deleteScopeItemAction(jobId: string, itemId: string): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await guard(jobId);
  if (!guarded) return { error: t("jobs.scope.notAllowed") };

  if (!(await deleteScopeItem(guarded.ctx, guarded.job.id, itemId))) return { error: t("jobs.scope.gone") };
  refresh(guarded.job.id);
  return { message: t("jobs.scope.deleted") };
}
