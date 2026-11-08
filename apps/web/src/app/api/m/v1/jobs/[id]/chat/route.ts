import { chatSegments } from "@nodo/core/jobs/chat/text";
import { canTouch } from "@nodo/core/jobs/rules";
import { chatBody } from "@/modules/jobs/chat/schemas";
import { chatPage, sendChatMessage } from "@/modules/jobs/chat/service";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { textSchema } from "@/modules/mobile/jobs/schemas";
import { fileView } from "@/modules/mobile/jobs/views";
import { mobileRoute, MobileError } from "@/modules/mobile/route";

/**
 * The chat's latest page, which the app polls while it is open, or with
 * `?before=<messageId>` the page before it. The same `chatPage` as the web's
 * feed; the mentions are resolved into segments here, against the people
 * stored on the message when it was sent, so the app never guesses at an `@`.
 */
export const GET = mobileRoute({
  permission: "chat.read",
  handler: async ({ ctx: base, params, request }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "chat.read");
    const page = await chatPage(ctx, job.id, new URL(request.url).searchParams.get("before"));
    const people = new Map(page.mentioned.map((person) => [person.id, person]));

    return {
      hasEarlier: page.hasEarlier,
      messages: page.messages.map((row) => ({
        id: row.id,
        author: row.author,
        segments: chatSegments(row.body, row.mentionIds.flatMap((id) => people.get(id) ?? [])),
        files: row.files.map(fileView),
        createdAt: row.createdAt.toISOString(),
        canDelete: canTouch(ctx.user.id, ctx.permissions, "chat.delete", row.authorId),
      })),
    };
  },
});

/** Sends a message; whoever it mentions hears about it, as from the web. */
export const POST = mobileRoute({
  permission: "chat.create",
  body: textSchema,
  handler: async ({ ctx: base, params, body }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "chat.create", "chat.read");
    const outcome = await sendChatMessage(ctx, job.id, chatBody(body.body), []);
    if (!outcome.ok) throw new MobileError(422, outcome.reason === "empty" ? "empty" : "files_refused");
    return { id: outcome.messageId };
  },
});
