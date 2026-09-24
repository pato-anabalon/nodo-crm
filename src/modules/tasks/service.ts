import type { CompanyContext } from "@/lib/auth/session";
import { NotificationKind, Prisma } from "@/generated/prisma/client";
import { notify } from "@/modules/notifications/inbox";
import { dueDedupeKey, isDue } from "@/modules/notifications/due";
import type { TaskFilters, TaskFormValues } from "./schemas";
import { taskWhere } from "./scope";

const withContext = {
  assignee: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, title: true } },
  quote: { select: { id: true, number: true, title: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.TaskInclude;

/**
 * The list, with each task already told whether it is late.
 *
 * Decided here and not in the page: working it out while rendering means
 * reading the clock during render, which makes the same markup depend on when
 * it happened to be produced.
 */
export async function listTasks(ctx: CompanyContext, filters: TaskFilters, now: Date = new Date()) {
  const tasks = await ctx.db.task.findMany({
    where: taskWhere(filters, ctx.user.id),
    include: withContext,
    // Undated tasks last: they're things to do, not promises about when.
    orderBy:
      filters.show === "done"
        ? [{ completedAt: "desc" }]
        : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 200,
  });

  return tasks.map((task) => ({ ...task, overdue: isDue(task, now) }));
}

/** Everything still open on one lead, quote or contact. */
export async function tasksFor(
  ctx: CompanyContext,
  link: { leadId?: string; quoteId?: string; contactId?: string },
) {
  return ctx.db.task.findMany({
    where: { ...link, completedAt: null },
    include: withContext,
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
}

export async function createTask(ctx: CompanyContext, values: TaskFormValues) {
  const task = await ctx.db.task.create({
    data: {
      companyId: ctx.company.id,
      createdById: ctx.user.id,
      title: values.title,
      notes: values.notes ?? null,
      dueAt: values.dueAt,
      assigneeId: values.assigneeId ?? null,
      leadId: values.leadId ?? null,
      quoteId: values.quoteId ?? null,
      contactId: values.contactId ?? null,
    },
  });

  await notifyAssignee(ctx, task);
  return task;
}

export async function updateTask(
  ctx: CompanyContext,
  id: string,
  values: TaskFormValues,
): Promise<boolean> {
  const before = await ctx.db.task.findFirst({ where: { id }, select: { assigneeId: true } });
  if (!before) return false;

  await ctx.db.task.updateMany({
    where: { id },
    data: {
      title: values.title,
      notes: values.notes ?? null,
      dueAt: values.dueAt,
      assigneeId: values.assigneeId ?? null,
    },
  });

  // Only on a change of hands: re-saving your own task shouldn't ping you.
  if (values.assigneeId && values.assigneeId !== before.assigneeId) {
    const task = await ctx.db.task.findFirst({ where: { id } });
    if (task) await notifyAssignee(ctx, task);
  }

  return true;
}

/**
 * Marks a task done, or puts it back.
 *
 * `completedAt` is set to the moment rather than a flag, because when something
 * was finished is part of the record — and reopening clears it, since a task
 * done twice has only one finish that matters: the last one.
 */
export async function setTaskDone(
  ctx: CompanyContext,
  id: string,
  done: boolean,
): Promise<boolean> {
  const { count } = await ctx.db.task.updateMany({
    where: { id },
    data: { completedAt: done ? new Date() : null },
  });
  return count > 0;
}

export async function deleteTask(ctx: CompanyContext, id: string): Promise<boolean> {
  const { count } = await ctx.db.task.deleteMany({ where: { id } });
  return count > 0;
}

async function notifyAssignee(
  ctx: CompanyContext,
  task: { id: string; title: string; assigneeId: string | null },
): Promise<void> {
  // Putting a task in your own name is not news to you.
  if (!task.assigneeId || task.assigneeId === ctx.user.id) return;

  await notify({
    companyId: ctx.company.id,
    userId: task.assigneeId,
    kind: NotificationKind.TASK_ASSIGNED,
    params: { title: task.title, by: ctx.user.name ?? ctx.user.email },
    href: "/tasks",
  });
}

/**
 * Raises a notice for each of this person's tasks that has fallen due.
 *
 * Run when they open the app, which is when a bell can actually be read. The
 * dedupe key holds one notice per task per day, so a task overdue for a week
 * nags seven times rather than once per page view.
 */
export async function syncDueTasks(ctx: CompanyContext, now: Date = new Date()): Promise<number> {
  const candidates = await ctx.db.task.findMany({
    where: { assigneeId: ctx.user.id, completedAt: null, dueAt: { not: null, lte: now } },
    select: { id: true, title: true, dueAt: true, completedAt: true },
    take: 50,
  });

  const due = candidates.filter((task) => isDue(task, now));

  for (const task of due) {
    await notify({
      companyId: ctx.company.id,
      userId: ctx.user.id,
      kind: NotificationKind.TASK_DUE,
      params: { title: task.title },
      href: "/tasks",
      dedupeKey: dueDedupeKey(task.id, now),
    });
  }

  return due.length;
}
