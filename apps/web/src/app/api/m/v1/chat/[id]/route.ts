import { canTouch } from "@nodo/core/jobs/rules";
import { ForbiddenError } from "@/lib/auth/session";
import { deleteChatMessage, findChatMessage } from "@/modules/jobs/chat/service";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { mobileRoute } from "@/modules/mobile/route";

/** Own messages with `chat.delete`; anybody else's needs `jobs.moderate` too. */
export const DELETE = mobileRoute({
  permission: "chat.delete",
  handler: async ({ ctx: base, params }) => {
    const message = found(await findChatMessage(base, String(params.id)));
    const { ctx } = await jobIn(base, message.jobId, "chat.delete", "chat.read");
    if (!canTouch(ctx.user.id, ctx.permissions, "chat.delete", message.authorId)) throw new ForbiddenError("jobs.moderate");

    await deleteChatMessage(ctx, message);
  },
});
