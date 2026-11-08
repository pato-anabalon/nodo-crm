import { plainTextToHtml } from "@/lib/rich-text";
import { createTodoList } from "@/modules/jobs/todos/service";
import { todoListSchema } from "@/modules/jobs/todos/schemas";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { todoListCreateSchema } from "@/modules/mobile/jobs/schemas";
import { mobileRoute, validate } from "@/modules/mobile/route";

/**
 * A new list at the bottom of the job's, behind `todos.create` as on the web,
 * with its timeline line. The description arrives as plain text and goes
 * through the web's own `todoListSchema`.
 */
export const POST = mobileRoute({
  permission: "todos.create",
  body: todoListCreateSchema,
  handler: async ({ ctx: base, params, body }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "todos.create", "todos.read");
    const values = validate(todoListSchema, { name: body.name, description: plainTextToHtml(body.description) });
    return { id: await createTodoList(ctx, job.id, values) };
  },
});
