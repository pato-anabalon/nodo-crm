import { listPostCategories, listPosts } from "@/modules/jobs/board/service";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * The Message Board's published posts, newest first, with `?category=<id>` to
 * narrow them — a line of each, not the post. The categories come along for
 * the filter as stored: a standard one carries its `key` and no name, and the
 * app translates it as the web does (`jobs.board.categories.<key>`).
 *
 * Read-only in the app: posts are written on the web, where the editor is.
 */
export const GET = mobileRoute({
  permission: "messages.read",
  handler: async ({ ctx: base, params, request }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "messages.read");
    const categories = await listPostCategories(ctx);
    const asked = new URL(request.url).searchParams.get("category");
    // An id that isn't one of this company's reads as no filter, as on the web.
    const categoryId = asked && categories.some((category) => category.id === asked) ? asked : null;
    const posts = await listPosts(ctx, job.id, categoryId);

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
