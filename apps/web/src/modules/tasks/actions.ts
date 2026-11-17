"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { taskFormSchema } from "./schemas";
import { createTask, deleteTask, setTaskDone, updateTask } from "./service";

export type TaskState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Guarded by `leads.update`: a task is a note to the team about work in hand,
 * and whoever can move the work can leave one. A family of its own would mean
 * a permission nobody remembers to grant.
 */
const PERMISSION = "leads.update" as const;

function values(formData: FormData) {
  return {
    title: formData.get("title"),
    notes: formData.get("notes"),
    dueAt: formData.get("dueAt"),
    assigneeId: formData.get("assigneeId"),
    leadId: formData.get("leadId"),
    quoteId: formData.get("quoteId"),
    contactId: formData.get("contactId"),
  };
}

function refresh(formData: FormData) {
  revalidatePath("/tasks");
  const leadId = formData.get("leadId");
  const quoteId = formData.get("quoteId");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (quoteId) revalidatePath(`/quotes/${quoteId}`);
}

export async function createTaskAction(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const ctx = await requirePermission(PERMISSION);
  const t = await getTranslations();

  const parsed = taskFormSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await createTask(ctx, parsed.data);
  refresh(formData);
  return { message: t("tasks.added") };
}

export async function updateTaskAction(
  id: string,
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const ctx = await requirePermission(PERMISSION);
  const t = await getTranslations();

  const parsed = taskFormSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const done = await updateTask(ctx, id, parsed.data);
  if (!done) return { error: t("tasks.notFound") };

  refresh(formData);
  return { message: t("common.saveChanges") };
}

export async function setTaskDoneAction(id: string, done: boolean): Promise<TaskState> {
  const ctx = await requirePermission(PERMISSION);
  const t = await getTranslations("tasks");

  const ok = await setTaskDone(ctx, id, done);
  revalidatePath("/tasks");
  if (!ok) return { error: t("notFound") };

  return { message: done ? t("completed") : t("reopened") };
}

export async function deleteTaskAction(id: string): Promise<TaskState> {
  const ctx = await requirePermission(PERMISSION);
  const t = await getTranslations("tasks");

  const ok = await deleteTask(ctx, id);
  revalidatePath("/tasks");
  return ok ? { message: t("deleted") } : { error: t("notFound") };
}
