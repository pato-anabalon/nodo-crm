import { plainTextToHtml } from "@/lib/rich-text";
import { findTodoList, updateTodoList } from "@/modules/jobs/todos/service";
import { todoListSchema } from "@/modules/jobs/todos/schemas";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { todoListUpdateSchema } from "@/modules/mobile/jobs/schemas";
import { mobileRoute, validate } from "@/modules/mobile/route";

/**
 * Renames a list or rewrites its description, on the job read from its row.
 * What isn't sent keeps its value. Deleting a list and reordering lists stay
 * on the web: one takes every to-do on it, and the other is a plan laid out
 * on a screen wide enough to see it.
 */
export const PATCH = mobileRoute({
  permission: "todos.update",
  body: todoListUpdateSchema,
  handler: async ({ ctx: base, params, body }) => {
    const list = found(await findTodoList(base, String(params.id)));
    const { ctx } = await jobIn(base, list.jobId, "todos.update", "todos.read");
    const values = validate(todoListSchema, {
      name: body.name ?? list.name,
      description: body.description === undefined ? (list.description ?? "") : plainTextToHtml(body.description),
    });
    await updateTodoList(ctx, list, values);
    return { id: list.id };
  },
});
