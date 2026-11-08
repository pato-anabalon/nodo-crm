import { plainTextToHtml } from "@/lib/rich-text";
import { createTodo, findTodoList } from "@/modules/jobs/todos/service";
import { todoSchema } from "@/modules/jobs/todos/schemas";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { todoCreateSchema } from "@/modules/mobile/jobs/schemas";
import { mobileRoute, MobileError, validate } from "@/modules/mobile/route";

/**
 * Adds a to-do at the bottom of a list. The notes arrive as plain text and go
 * through the web's own `todoSchema`, so they are stored exactly as the editor
 * would have saved them; assignees are cut to the job's people by the service.
 */
export const POST = mobileRoute({
  permission: "todos.create",
  body: todoCreateSchema,
  handler: async ({ ctx: base, params, body }) => {
    const list = found(await findTodoList(base, String(params.id)));
    const { ctx } = await jobIn(base, list.jobId, "todos.create", "todos.read");

    const values = validate(todoSchema, {
      title: body.title,
      notes: plainTextToHtml(body.notes),
      startsOn: body.startsOn ?? null,
      dueOn: body.dueOn ?? null,
    });
    const outcome = await createTodo(ctx, list, values, { assigneeIds: body.assigneeIds ?? [], uploads: [] });
    if (!outcome.ok) throw new MobileError(422, "files_refused");
    return { id: outcome.todoId };
  },
});
