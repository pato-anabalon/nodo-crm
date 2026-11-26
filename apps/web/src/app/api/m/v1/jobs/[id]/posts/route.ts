import { BOARDS } from "@nodo/core/jobs/boards";
import { listPostCategories, listPosts } from "@/modules/jobs/board/service";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * The Message Board's published posts, newest first, with `?category=<id>` to
 * narrow them — a line of each, not the post. The categories come along for
 * the filter as stored: a standard one carries its `key` and no name, and the
 * app translates it as the web does (`jobs.board.categories.<key>`).
 *
 * `?board=confidential` is the confidential board instead, behind its own
 * `confidential.read`; anything else is the Message Board.
 *
 * Read-only in the app: posts are written on the web, where the editor is.
 */
export const GET = mobileRoute({
  handler: async ({ ctx: base, params, request }) => {
    const search = new URL(request.url).searchParams;
    const board = search.get("board") === "confidential" ? "CONFIDENTIAL" : "TEAM";
    const { ctx, job } = await jobIn(base, String(params.id), BOARDS[board].read);
    const categories = await listPostCategories(ctx);
    const asked = search.get("category");
    // An id that isn't one of this company's reads as no filter, as on the web.
    const categoryId = asked && categories.some((category) => category.id === asked) ? asked : null;
    const posts = await listPosts(ctx, job.id, board, categoryId);

    return {
      categories,
      categoryId,
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt!.toISOString(),
        author: post.author,
        category: post.category,
        commentCount: post._count.comments,
        fileCount: post._count.files,
      })),
    };
  },
});
