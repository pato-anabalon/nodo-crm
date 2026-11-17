import { findTodo, setTodoCompleted } from "@/modules/jobs/todos/service";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { completionSchema } from "@/modules/mobile/jobs/schemas";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * Ticking off and back on — the one thing `todos.complete` reaches. Sent as the
 * state wanted rather than a toggle, so a retry after a dropped connection
 * can't undo the first press; `changed` says whether this one did anything.
 */
export const PUT = mobileRoute({
  permission: "todos.complete",
  body: completionSchema,
  handler: async ({ ctx: base, params, body }) => {
    const todo = found(await findTodo(base, String(params.id)));
    const { ctx } = await jobIn(base, todo.jobId, "todos.complete", "todos.read");
    const changed = await setTodoCompleted(ctx, todo, body.done);
    return { done: body.done, changed };
  },
});
