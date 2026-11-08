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
import { orderSchema, todoListSchema, todoSchema } from "./schemas";
import {
  createListComment,
  createTodo,
  createTodoComment,
  createTodoList,
  deleteTodo,
  deleteTodoList,
  findTodo,
  findTodoList,
  reorderTodoLists,
  reorderTodos,
  setTodoCompleted,
  updateTodo,
  updateTodoList,
} from "./service";

/**
 * Every to-do action goes through one of two guards, which read the job off
 * the row — never off the form — and ask for the tool's read permission as
 * well as the one for the act. Ticking off (`todos.complete`) and editing
 * (`todos.update`) are separate doors: a POST carrying a due date can't come
 * in through the one that only ticks.
 */

function refresh(jobId: string, ...paths: string[]) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/todos`);
  for (const path of paths) revalidatePath(`/jobs/${jobId}/todos/${path}`);
}

async function jobGuard(jobId: string, permission: Permission) {
  const { ctx, job } = await requireJobContext(jobId, permission);
  return can(ctx, "todos.read") ? { ctx, job } : null;
}

async function listGuard(listId: string, permission: Permission) {
  const base = await requireCompanyContext();
  const list = await findTodoList(base, listId);
  if (!list) return null;
  const { ctx } = await requireJobContext(list.jobId, permission);
  return can(ctx, "todos.read") ? { ctx, list } : null;
}

async function todoGuard(todoId: string, permission: Permission) {
  const base = await requireCompanyContext();
  const todo = await findTodo(base, todoId);
  if (!todo) return null;
  const { ctx } = await requireJobContext(todo.jobId, permission);
  return can(ctx, "todos.read") ? { ctx, todo } : null;
}

function listValues(formData: FormData) {
  return todoListSchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });
}

function todoValues(formData: FormData) {
  return todoSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") ?? "",
    startsOn: formData.get("startsOn"),
    dueOn: formData.get("dueOn"),
  });
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function createTodoListAction(jobId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await jobGuard(jobId, "todos.create");
  if (!guarded) return { error: t("jobs.todos.notAllowed") };

  const parsed = listValues(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  await createTodoList(guarded.ctx, guarded.job.id, parsed.data);
  refresh(guarded.job.id);
  return { message: t("jobs.todos.listCreated") };
}

export async function updateTodoListAction(listId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await listGuard(listId, "todos.update");
  if (!guarded) return { error: t("jobs.todos.notAllowed") };

  const parsed = listValues(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  await updateTodoList(guarded.ctx, guarded.list, parsed.data);
  refresh(guarded.list.jobId, `lists/${listId}`);
  return { message: t("jobs.todos.listSaved") };
}

export async function deleteTodoListAction(listId: string): Promise<JobActionState> {
  const t = await getTranslations("jobs.todos");
  const guarded = await listGuard(listId, "todos.delete");
  if (!guarded) return { error: t("notAllowed") };

  await deleteTodoList(guarded.ctx, guarded.list.jobId, listId);
  refresh(guarded.list.jobId);
  redirect(`/jobs/${guarded.list.jobId}/todos`);
}

export async function reorderTodoListsAction(jobId: string, ids: string[]): Promise<JobActionState> {
  const t = await getTranslations("jobs.todos");
  const guarded = await jobGuard(jobId, "todos.update");
  const parsed = orderSchema.safeParse(ids);
  if (!guarded || !parsed.success) return { error: t("notAllowed") };

  if (!(await reorderTodoLists(guarded.ctx, guarded.job.id, parsed.data))) return { error: t("orderStale") };
  refresh(guarded.job.id);
  return {};
}

// ---------------------------------------------------------------------------
// To-dos
// ---------------------------------------------------------------------------

export async function createTodoAction(listId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await listGuard(listId, "todos.create");
  if (!guarded) return { error: t("jobs.todos.notAllowed") };

  const parsed = todoValues(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await createTodo(guarded.ctx, guarded.list, parsed.data, {
    assigneeIds: idsFrom(formData.getAll("assigneeId")),
    uploads: parseUploads(formData.get("attachments")),
  });
  if (!outcome.ok) return { error: t("jobs.board.filesRefused") };

  refresh(guarded.list.jobId, `lists/${listId}`);
  return { message: t("jobs.todos.todoAdded") };
}

export async function updateTodoAction(todoId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await todoGuard(todoId, "todos.update");
  if (!guarded) return { error: t("jobs.todos.notAllowed") };

  const parsed = todoValues(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const listId = formData.get("listId");
  const outcome = await updateTodo(guarded.ctx, guarded.todo, parsed.data, {
    listId: typeof listId === "string" && listId ? listId : guarded.todo.listId,
    assigneeIds: idsFrom(formData.getAll("assigneeId")),
    uploads: parseUploads(formData.get("attachments")),
    removeFileIds: idsFrom(formData.getAll("removeFileId")),
  });
  if (!outcome.ok) return { error: t(outcome.reason === "list" ? "jobs.todos.notAllowed" : "jobs.board.filesRefused") };

  const { jobId } = guarded.todo;
  refresh(jobId, todoId, `lists/${guarded.todo.listId}`);
  redirect(`/jobs/${jobId}/todos/${todoId}`);
}

/** Ticking off and back on — the one thing `todos.complete` reaches. */
export async function setTodoCompletedAction(todoId: string, done: boolean): Promise<JobActionState> {
  const t = await getTranslations("jobs.todos");
  const guarded = await todoGuard(todoId, "todos.complete");
  if (!guarded) return { error: t("notAllowed") };

  await setTodoCompleted(guarded.ctx, guarded.todo, done === true);
  refresh(guarded.todo.jobId, todoId, `lists/${guarded.todo.listId}`);
  return {};
}

export async function deleteTodoAction(todoId: string): Promise<JobActionState> {
  const t = await getTranslations("jobs.todos");
  const guarded = await todoGuard(todoId, "todos.delete");
  if (!guarded) return { error: t("notAllowed") };

  await deleteTodo(guarded.ctx, guarded.todo.jobId, todoId);
  refresh(guarded.todo.jobId, `lists/${guarded.todo.listId}`);
  redirect(`/jobs/${guarded.todo.jobId}/todos`);
}

export async function reorderTodosAction(listId: string, ids: string[]): Promise<JobActionState> {
  const t = await getTranslations("jobs.todos");
  const guarded = await listGuard(listId, "todos.update");
  const parsed = orderSchema.safeParse(ids);
  if (!guarded || !parsed.success) return { error: t("notAllowed") };

  if (!(await reorderTodos(guarded.ctx, listId, parsed.data))) return { error: t("orderStale") };
  refresh(guarded.list.jobId, `lists/${listId}`);
  return {};
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function createTodoCommentAction(todoId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await todoGuard(todoId, "comments.create");
  if (!guarded) return { error: t("jobs.todos.notAllowed") };

  const parsed = commentSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await createTodoComment(guarded.ctx, guarded.todo, parsed.data.body, parseUploads(formData.get("attachments")));
  if (!outcome.ok) return { error: t(outcome.reason === "empty" ? "jobs.board.commentEmpty" : "jobs.board.filesRefused") };

  refresh(guarded.todo.jobId, todoId);
  return { message: t("jobs.board.commented") };
}

export async function createListCommentAction(listId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await listGuard(listId, "comments.create");
  if (!guarded) return { error: t("jobs.todos.notAllowed") };

  const parsed = commentSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await createListComment(guarded.ctx, guarded.list, parsed.data.body, parseUploads(formData.get("attachments")));
  if (!outcome.ok) return { error: t(outcome.reason === "empty" ? "jobs.board.commentEmpty" : "jobs.board.filesRefused") };

  refresh(guarded.list.jobId, `lists/${listId}`);
  return { message: t("jobs.board.commented") };
}
