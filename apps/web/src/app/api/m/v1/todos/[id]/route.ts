import { plainTextToHtml } from "@/lib/rich-text";
import { dayKey } from "@/modules/jobs/schemas";
import { findTodo, getTodo, updateTodo } from "@/modules/jobs/todos/service";
import { todoSchema } from "@/modules/jobs/todos/schemas";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { todoUpdateSchema } from "@/modules/mobile/jobs/schemas";
import { commentView, fileView, richText, today } from "@/modules/mobile/jobs/views";
import { mobileRoute, MobileError, validate } from "@/modules/mobile/route";
import { isOverdue } from "@nodo/core/jobs/todos/rules";

/** One to-do with its notes, files and conversation. */
export const GET = mobileRoute({
  permission: "todos.read",
  handler: async ({ ctx: base, params }) => {
    const row = found(await findTodo(base, String(params.id)));
    const { ctx } = await jobIn(base, row.jobId, "todos.read");
    const todo = found(await getTodo(ctx, row.jobId, row.id));
    const dueOn = dayKey(todo.dueOn);

    return {
      todo: {
        id: todo.id,
        jobId: row.jobId,
        list: todo.list,
        title: todo.title,
        notes: richText(todo.notes),
        startsOn: dayKey(todo.startsOn),
        dueOn,
        done: todo.completedAt !== null,
        completedAt: todo.completedAt?.toISOString() ?? null,
        completedBy: todo.completedBy,
        overdue: isOverdue(dueOn, todo.completedAt !== null, today(ctx)),
        createdAt: todo.createdAt.toISOString(),
        createdBy: todo.createdBy,
        assignees: todo.assignees.map((assignee) => assignee.user),
        files: todo.files.map(fileView),
        comments: todo.comments.map((comment) => commentView(ctx, comment)),
      },
    };
  },
});

/**
 * Changes what is sent and keeps the rest. Ticking off is not this door — it
 * is `PUT …/completion`, behind `todos.complete` — so a Worker who may only
 * tick can't move a date by posting here.
 */
export const PATCH = mobileRoute({
  permission: "todos.update",
  body: todoUpdateSchema,
  handler: async ({ ctx: base, params, body }) => {
    const row = found(await findTodo(base, String(params.id)));
    const { ctx } = await jobIn(base, row.jobId, "todos.update", "todos.read");
    const current = found(await getTodo(ctx, row.jobId, row.id));

    const values = validate(todoSchema, {
      title: body.title ?? current.title,
      notes: body.notes === undefined ? (current.notes ?? "") : plainTextToHtml(body.notes),
      startsOn: body.startsOn === undefined ? dayKey(current.startsOn) : body.startsOn,
      dueOn: body.dueOn === undefined ? dayKey(current.dueOn) : body.dueOn,
    });
    const outcome = await updateTodo(ctx, row, values, {
      listId: body.listId ?? row.listId,
      assigneeIds: body.assigneeIds ?? current.assignees.map((assignee) => assignee.user.id),
      uploads: [],
      removeFileIds: [],
    });
    if (!outcome.ok) throw outcome.reason === "list" ? new MobileError(404, "not_found") : new MobileError(422, "files_refused");
    return { id: row.id };
  },
});
