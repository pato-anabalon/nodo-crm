import { plainTextToHtml } from "@/lib/rich-text";
import { commentSchema } from "@/modules/jobs/board/schemas";
import { createComment, findPost } from "@/modules/jobs/board/service";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { textSchema } from "@/modules/mobile/jobs/schemas";
import { mobileRoute, MobileError, notFound, validate } from "@/modules/mobile/route";

/**
 * A comment on a published post, in plain text and with files. Heard about by
 * the post's author and whoever has commented, as from the web — the same
 * `createComment`.
 */
export const POST = mobileRoute({
  permission: "comments.create",
  body: textSchema,
  handler: async ({ ctx: base, params, body }) => {
    const post = found(await findPost(base, String(params.id)));
    if (!post.publishedAt) throw notFound();
    const { ctx } = await jobIn(base, post.jobId, "comments.create", "messages.read");

    const values = validate(commentSchema, { body: plainTextToHtml(body.body) });
    const outcome = await createComment(ctx, post, values.body, body.uploads ?? []);
    if (!outcome.ok) throw new MobileError(422, outcome.reason === "empty" ? "empty" : "files_refused");
    return { id: outcome.commentId };
  },
});
