import { findPost, getPost } from "@/modules/jobs/board/service";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { commentView, fileView, richText } from "@/modules/mobile/jobs/views";
import { mobileRoute, notFound } from "@/modules/mobile/route";

/**
 * One post with its files and its conversation. The body is the board's
 * `full` rich text, sanitised again on the way out, for the app to render
 * read-only. A draft — even the reader's own — answers 404: the app has no way
 * to finish one, and a draft is nobody else's to read.
 */
export const GET = mobileRoute({
  permission: "messages.read",
  handler: async ({ ctx: base, params }) => {
    const row = found(await findPost(base, String(params.id)));
    if (!row.publishedAt) throw notFound();
    const { ctx } = await jobIn(base, row.jobId, "messages.read");
    const post = found(await getPost(ctx, row.jobId, row.id));

    return {
      post: {
        id: post.id,
        jobId: post.jobId,
        title: post.title,
        body: richText(post.body) ?? "",
        publishedAt: post.publishedAt!.toISOString(),
        editedAt: post.editedAt?.toISOString() ?? null,
        author: post.author,
        category: post.category,
        files: post.files.map(fileView),
        comments: post.comments.map((comment) => commentView(ctx, comment)),
      },
    };
  },
});
