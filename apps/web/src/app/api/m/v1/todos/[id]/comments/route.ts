import { plainTextToHtml } from "@/lib/rich-text";
import { commentSchema } from "@/modules/jobs/board/schemas";
import { createTodoComment, findTodo } from "@/modules/jobs/todos/service";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { textSchema } from "@/modules/mobile/jobs/schemas";
import { mobileRoute, MobileError, validate } from "@/modules/mobile/route";

/** A comment on a to-do, in plain text; the people in the conversation hear about it as from the web. */
export const POST = mobileRoute({
  permission: "comments.create",
  body: textSchema,
  handler: async ({ ctx: base, params, body }) => {
    const todo = found(await findTodo(base, String(params.id)));
    const { ctx } = await jobIn(base, todo.jobId, "comments.create", "todos.read");

    const values = validate(commentSchema, { body: plainTextToHtml(body.body) });
    const outcome = await createTodoComment(ctx, todo, values.body, []);
    if (!outcome.ok) throw new MobileError(422, outcome.reason === "empty" ? "empty" : "files_refused");
    return { id: outcome.commentId };
  },
});
