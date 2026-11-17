import { listTodoLists } from "@/modules/jobs/todos/service";
import { richText, today, todoRowView } from "@/modules/mobile/jobs/views";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { mobileRoute } from "@/modules/mobile/route";

/** Every list on the job with its to-dos: open ones in their order, then done ones, latest first. */
export const GET = mobileRoute({
  permission: "todos.read",
  handler: async ({ ctx: base, params }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "todos.read");
    const day = today(ctx);
    const lists = await listTodoLists(ctx, job.id);
    return {
      lists: lists.map((list) => ({
        id: list.id,
        name: list.name,
        description: richText(list.description),
        comments: list._count.comments,
        open: list.open.map((row) => todoRowView(row, day)),
        done: list.done.map((row) => todoRowView(row, day)),
      })),
    };
  },
});
