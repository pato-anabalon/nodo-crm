import type { CompanyContext } from "@/lib/auth/session";
import { JobActivityType, NotificationKind } from "@/generated/prisma/client";
import { notifyEach } from "@/modules/notifications/inbox";
import { emailJobNotice } from "../emails";
import { attachFiles, deleteStored, detachFiles, jobFileSelect, type UploadedFile } from "../files-service";
import { logJobActivity } from "../service";
import { jobName, membersAmong, recipientsOnJob } from "../recipients";
import { addComment, commenters, commentThreadArgs, notifyConversation, type CommentOutcome } from "../comments/service";
import { commentHref } from "../comments/subject";
import { isPermutationOf, newlyAssigned } from "./rules";
import type { TodoListValues, TodoValues } from "./schemas";

/**
 * To-dos: lists, the things on them, who they are for and when.
 *
 * Every function takes the `jobId` the caller confirmed through
 * `requireJobContext` — for anything inside the job, the one read from the
 * row itself — and every lookup is filtered by it.
 */

const personSelect = { id: true, name: true, email: true, image: true } as const;

/** A to-do as a row of a list shows it. */
const todoRowSelect = {
  id: true,
  listId: true,
  title: true,
  notes: true,
  startsOn: true,
  dueOn: true,
  completedAt: true,
  position: true,
  assignees: { orderBy: { createdAt: "asc" }, select: { user: { select: personSelect } } },
  _count: { select: { comments: true, files: true } },
} as const;

type TodoRowData = {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  startsOn: Date | null;
  dueOn: Date | null;
  completedAt: Date | null;
  position: number;
  assignees: { user: { id: string; name: string | null; email: string; image: string | null } }[];
  _count: { comments: number; files: number };
};

/**
 * Open to-dos in the order somebody arranged them; done ones after, the most
 * recently finished first — which is where somebody looks for what just
 * happened.
 */
function splitByDone<T extends { completedAt: Date | null }>(todos: T[]) {
  const open = todos.filter((todo) => !todo.completedAt);
  const done = todos
    .filter((todo) => todo.completedAt)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  return { open, done };
}

const listOrder = [{ position: "asc" as const }, { createdAt: "asc" as const }];
const todoOrder = [{ position: "asc" as const }, { createdAt: "asc" as const }];

export async function listTodoLists(ctx: CompanyContext, jobId: string) {
  const lists = await ctx.db.jobTodoList.findMany({
    where: { jobId },
    orderBy: listOrder,
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { comments: true } },
      todos: { orderBy: todoOrder, select: todoRowSelect },
    },
  });
  return lists.map(({ todos, ...list }) => ({ ...list, ...splitByDone(todos as TodoRowData[]) }));
}

export type TodoListView = Awaited<ReturnType<typeof listTodoLists>>[number];
export type TodoRow = TodoRowData;

export async function getTodoList(ctx: CompanyContext, jobId: string, listId: string) {
  const list = await ctx.db.jobTodoList.findFirst({
    where: { id: listId, jobId },
    select: {
      id: true,
      name: true,
      description: true,
      createdById: true,
      createdAt: true,
      createdBy: { select: personSelect },
      _count: { select: { comments: true } },
      todos: { orderBy: todoOrder, select: todoRowSelect },
      comments: commentThreadArgs,
    },
  });
  if (!list) return null;
  const { todos, ...rest } = list;
  return { ...rest, ...splitByDone(todos as TodoRowData[]) };
}

export async function getTodo(ctx: CompanyContext, jobId: string, todoId: string) {
  return ctx.db.jobTodo.findFirst({
    where: { id: todoId, jobId },
    select: {
      id: true,
      listId: true,
      title: true,
      notes: true,
      startsOn: true,
      dueOn: true,
      completedAt: true,
      createdAt: true,
      createdById: true,
      list: { select: { id: true, name: true } },
      createdBy: { select: personSelect },
      completedBy: { select: personSelect },
      assignees: { orderBy: { createdAt: "asc" }, select: { user: { select: personSelect } } },
      files: { orderBy: { createdAt: "asc" }, select: jobFileSelect },
      comments: commentThreadArgs,
    },
  });
}

export type TodoDetail = NonNullable<Awaited<ReturnType<typeof getTodo>>>;

/** A to-do as the guards need it. */
export async function findTodo(ctx: CompanyContext, todoId: string) {
  return ctx.db.jobTodo.findFirst({
    where: { id: todoId },
    select: { id: true, jobId: true, listId: true, title: true, createdById: true, completedAt: true },
  });
}

export async function findTodoList(ctx: CompanyContext, listId: string) {
  return ctx.db.jobTodoList.findFirst({
    where: { id: listId },
    select: { id: true, jobId: true, name: true, createdById: true },
  });
}

/** For the card on the job's page: each list with how far along it is. */
export async function todosSummary(ctx: CompanyContext, jobId: string, take = 4) {
  const lists = await ctx.db.jobTodoList.findMany({
    where: { jobId },
    orderBy: listOrder,
    select: { id: true, name: true, todos: { select: { completedAt: true } } },
  });
  const open = lists.reduce((sum, list) => sum + list.todos.filter((todo) => !todo.completedAt).length, 0);
  return {
    open,
    listCount: lists.length,
    lists: lists.slice(0, take).map((list) => ({
      id: list.id,
      name: list.name,
      done: list.todos.filter((todo) => todo.completedAt).length,
      total: list.todos.length,
    })),
  };
}

/** Everybody on the job — who a to-do can be for. */
export async function assignableMembers(ctx: CompanyContext, jobId: string) {
  const members = await ctx.db.jobMember.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
    select: { user: { select: personSelect } },
  });
  return members.map((member) => member.user);
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** A new list goes to the bottom: the order of the lists is somebody's plan. */
export async function createTodoList(ctx: CompanyContext, jobId: string, values: TodoListValues): Promise<string> {
  const last = await ctx.db.jobTodoList.aggregate({ where: { jobId }, _max: { position: true } });
  const list = await ctx.db.jobTodoList.create({
    data: {
      companyId: ctx.company.id,
      jobId,
      name: values.name,
      description: values.description,
      position: (last._max.position ?? -1) + 1,
      createdById: ctx.user.id,
    },
    select: { id: true },
  });
  await logJobActivity(ctx, jobId, JobActivityType.TODO_LIST_CREATED, { listId: list.id, name: values.name });
  return list.id;
}

export async function updateTodoList(ctx: CompanyContext, list: { id: string; jobId: string }, values: TodoListValues) {
  await ctx.db.jobTodoList.updateMany({
    where: { id: list.id, jobId: list.jobId },
    data: { name: values.name, description: values.description },
  });
}

/**
 * Deletes a list with everything on it: its to-dos, their comments and files,
 * and its own comments. Rows first, stored files after; every timeline line
 * about the list or anything on it goes too, matched on `listId`.
 */
export async function deleteTodoList(ctx: CompanyContext, jobId: string, listId: string): Promise<void> {
  const files = await ctx.db.jobFile.findMany({
    where: {
      jobId,
      OR: [{ todo: { listId } }, { comment: { todo: { listId } } }, { comment: { todoListId: listId } }],
    },
    select: { url: true, thumbnailUrl: true },
  });
  await ctx.db.jobTodoList.deleteMany({ where: { id: listId, jobId } });
  await ctx.db.jobActivity.deleteMany({ where: { jobId, params: { path: ["listId"], equals: listId } } });
  await deleteStored(files);
}

/** Puts the job's lists in the order given — all of them, each once, or nothing. */
export async function reorderTodoLists(ctx: CompanyContext, jobId: string, ids: string[]): Promise<boolean> {
  const current = await ctx.db.jobTodoList.findMany({ where: { jobId }, select: { id: true } });
  if (!isPermutationOf(current.map((list) => list.id), ids)) return false;
  // Not one transaction — `$transaction` doesn't travel through the tenant
  // extension — but each write is filtered, and a reorder that half lands is
  // put right by the next one.
  await Promise.all(ids.map((id, position) => ctx.db.jobTodoList.updateMany({ where: { id, jobId }, data: { position } })));
  return true;
}

// ---------------------------------------------------------------------------
// To-dos
// ---------------------------------------------------------------------------

export type TodoOutcome = { ok: true; todoId: string } | { ok: false; reason: "files" | "list" };

async function nextPosition(ctx: CompanyContext, listId: string): Promise<number> {
  const last = await ctx.db.jobTodo.aggregate({ where: { listId }, _max: { position: true } });
  return (last._max.position ?? -1) + 1;
}

/**
 * Adds a to-do at the bottom of its list. If an attachment is refused the
 * to-do is taken back out, so nothing half-made reaches the list or the
 * timeline.
 */
export async function createTodo(
  ctx: CompanyContext,
  list: { id: string; jobId: string },
  values: TodoValues,
  options: { assigneeIds: string[]; uploads: UploadedFile[] },
): Promise<TodoOutcome> {
  const assigneeIds = await membersAmong(ctx, list.jobId, options.assigneeIds);
  const todo = await ctx.db.jobTodo.create({
    data: {
      companyId: ctx.company.id,
      jobId: list.jobId,
      listId: list.id,
      title: values.title,
      notes: values.notes,
      startsOn: values.startsOn,
      dueOn: values.dueOn,
      position: await nextPosition(ctx, list.id),
      createdById: ctx.user.id,
      assignees: { create: assigneeIds.map((userId) => ({ companyId: ctx.company.id, userId })) },
    },
    select: { id: true },
  });

  if (!(await attachFiles(ctx, list.jobId, { todoId: todo.id }, options.uploads))) {
    await ctx.db.jobTodo.deleteMany({ where: { id: todo.id } });
    return { ok: false, reason: "files" };
  }

  await logJobActivity(ctx, list.jobId, JobActivityType.TODO_ADDED, {
    listId: list.id,
    todoId: todo.id,
    title: values.title,
  });
  await notifyAssigned(ctx, list.jobId, todo.id, values.title, assigneeIds);
  return { ok: true, todoId: todo.id };
}

/**
 * Saves changes to a to-do: its text, dates, people and files, and the list it
 * sits on. Only people newly put on it hear about it; somebody who was already
 * assigned doesn't get a notice for a changed date.
 */
export async function updateTodo(
  ctx: CompanyContext,
  todo: { id: string; jobId: string; listId: string },
  values: TodoValues,
  options: { listId: string; assigneeIds: string[]; uploads: UploadedFile[]; removeFileIds: string[] },
): Promise<TodoOutcome> {
  // Moving to another list: only one of this job's.
  const moving = options.listId !== todo.listId;
  if (moving) {
    const target = await ctx.db.jobTodoList.findFirst({ where: { id: options.listId, jobId: todo.jobId }, select: { id: true } });
    if (!target) return { ok: false, reason: "list" };
  }

  if (!(await attachFiles(ctx, todo.jobId, { todoId: todo.id }, options.uploads))) return { ok: false, reason: "files" };
  await detachFiles(ctx, { todoId: todo.id }, options.removeFileIds);

  const assigneeIds = await membersAmong(ctx, todo.jobId, options.assigneeIds);
  const before = await ctx.db.jobTodoAssignee.findMany({ where: { todoId: todo.id }, select: { userId: true } });
  const beforeIds = before.map((row) => row.userId);
  const added = newlyAssigned(beforeIds, assigneeIds);
  const removed = beforeIds.filter((id) => !assigneeIds.includes(id));

  await ctx.db.jobTodo.update({
    where: { id: todo.id },
    data: {
      title: values.title,
      notes: values.notes,
      startsOn: values.startsOn,
      dueOn: values.dueOn,
      ...(moving ? { listId: options.listId, position: await nextPosition(ctx, options.listId) } : {}),
    },
  });
  if (removed.length > 0) await ctx.db.jobTodoAssignee.deleteMany({ where: { todoId: todo.id, userId: { in: removed } } });
  if (added.length > 0) {
    await ctx.db.jobTodoAssignee.createMany({
      data: added.map((userId) => ({ companyId: ctx.company.id, todoId: todo.id, userId })),
      skipDuplicates: true,
    });
  }
  // The to-do's lines follow it, so deleting its new list takes them too.
  if (moving) {
    const lines = await ctx.db.jobActivity.findMany({
      where: { jobId: todo.jobId, params: { path: ["todoId"], equals: todo.id } },
      select: { id: true, params: true },
    });
    for (const line of lines) {
      const params = line.params && typeof line.params === "object" ? (line.params as Record<string, unknown>) : {};
      await ctx.db.jobActivity.update({ where: { id: line.id }, data: { params: { ...params, listId: options.listId } } });
    }
  }

  await notifyAssigned(ctx, todo.jobId, todo.id, values.title, added);
  return { ok: true, todoId: todo.id };
}

async function notifyAssigned(ctx: CompanyContext, jobId: string, todoId: string, title: string, userIds: string[]) {
  const recipients = await recipientsOnJob(ctx, jobId, userIds, "todos.read");
  if (recipients.length === 0) return;
  const params = { by: ctx.user.name ?? ctx.user.email, job: await jobName(ctx, jobId), title };
  const raised = await notifyEach(recipients, {
    companyId: ctx.company.id,
    kind: NotificationKind.JOB_TODO_ASSIGNED,
    params,
    href: `/jobs/${jobId}/todos/${todoId}`,
  });
  emailJobNotice(ctx, { userIds: raised, template: "todoAssigned", params, path: `/jobs/${jobId}/todos/${todoId}` });
}

/**
 * Ticks a to-do off, or back on. Each is a line on the timeline — who did it
 * and when is the history the job keeps. Only a real change counts: a second
 * press of the same box, or two people pressing it at once, writes one line.
 *
 * Finishing one tells whoever wrote it down, the way Basecamp does: they are
 * the one waiting to hear it is done.
 */
export async function setTodoCompleted(
  ctx: CompanyContext,
  todo: { id: string; jobId: string; listId: string; title: string; createdById: string | null },
  done: boolean,
): Promise<boolean> {
  const { count } = await ctx.db.jobTodo.updateMany({
    where: { id: todo.id, jobId: todo.jobId, completedAt: done ? null : { not: null } },
    data: done ? { completedAt: new Date(), completedById: ctx.user.id } : { completedAt: null, completedById: null },
  });
  if (count === 0) return false;

  await logJobActivity(ctx, todo.jobId, done ? JobActivityType.TODO_COMPLETED : JobActivityType.TODO_REOPENED, {
    listId: todo.listId,
    todoId: todo.id,
    title: todo.title,
  });

  if (done) {
    const recipients = await recipientsOnJob(ctx, todo.jobId, [todo.createdById], "todos.read");
    if (recipients.length > 0) {
      await notifyEach(recipients, {
        companyId: ctx.company.id,
        kind: NotificationKind.JOB_TODO_COMPLETED,
        params: { by: ctx.user.name ?? ctx.user.email, job: await jobName(ctx, todo.jobId), title: todo.title },
        href: `/jobs/${todo.jobId}/todos/${todo.id}`,
      });
    }
  }
  return true;
}

/** Deletes a to-do with its comments and files, and its lines on the timeline. */
export async function deleteTodo(ctx: CompanyContext, jobId: string, todoId: string): Promise<void> {
  const files = await ctx.db.jobFile.findMany({
    where: { jobId, OR: [{ todoId }, { comment: { todoId } }] },
    select: { url: true, thumbnailUrl: true },
  });
  await ctx.db.jobTodo.deleteMany({ where: { id: todoId, jobId } });
  await ctx.db.jobActivity.deleteMany({ where: { jobId, params: { path: ["todoId"], equals: todoId } } });
  await deleteStored(files);
}

/**
 * Puts a list's open to-dos in the order given. Done ones aren't part of it:
 * they sit below, by when they were finished, and keep their place for if
 * they are ever reopened.
 */
export async function reorderTodos(ctx: CompanyContext, listId: string, ids: string[]): Promise<boolean> {
  const current = await ctx.db.jobTodo.findMany({ where: { listId, completedAt: null }, select: { id: true } });
  if (!isPermutationOf(current.map((todo) => todo.id), ids)) return false;
  await Promise.all(ids.map((id, position) => ctx.db.jobTodo.updateMany({ where: { id, listId }, data: { position } })));
  return true;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * A comment on a to-do. The conversation is whoever wrote it down, whoever it
 * is for, and whoever has commented already.
 */
export async function createTodoComment(
  ctx: CompanyContext,
  todo: { id: string; jobId: string; listId: string; title: string; createdById: string | null },
  body: string,
  uploads: UploadedFile[],
): Promise<CommentOutcome> {
  const outcome = await addComment(ctx, todo.jobId, { todoId: todo.id }, body, uploads);
  if (!outcome.ok) return outcome;

  await logJobActivity(ctx, todo.jobId, JobActivityType.TODO_COMMENTED, {
    listId: todo.listId,
    todoId: todo.id,
    commentId: outcome.commentId,
    title: todo.title,
  });
  const assignees = await ctx.db.jobTodoAssignee.findMany({ where: { todoId: todo.id }, select: { userId: true } });
  await notifyConversation(ctx, {
    jobId: todo.jobId,
    people: [todo.createdById, ...assignees.map((row) => row.userId), ...(await commenters(ctx, { todoId: todo.id }))],
    permission: "todos.read",
    title: todo.title,
    href: commentHref(todo.jobId, { kind: "todo", id: todo.id }, outcome.commentId),
  });
  return outcome;
}

/** A comment on a list as a whole — the plan, rather than one step of it. */
export async function createListComment(
  ctx: CompanyContext,
  list: { id: string; jobId: string; name: string; createdById: string | null },
  body: string,
  uploads: UploadedFile[],
): Promise<CommentOutcome> {
  const outcome = await addComment(ctx, list.jobId, { todoListId: list.id }, body, uploads);
  if (!outcome.ok) return outcome;

  await logJobActivity(ctx, list.jobId, JobActivityType.TODO_COMMENTED, {
    listId: list.id,
    commentId: outcome.commentId,
    title: list.name,
  });
  await notifyConversation(ctx, {
    jobId: list.jobId,
    people: [list.createdById, ...(await commenters(ctx, { todoListId: list.id }))],
    permission: "todos.read",
    title: list.name,
    href: commentHref(list.jobId, { kind: "list", id: list.id }, outcome.commentId),
  });
  return outcome;
}
