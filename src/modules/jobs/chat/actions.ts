"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { requireJobContext } from "../access";
import type { JobActionState } from "../actions";
import { parseUploads } from "../board/schemas";
import { canTouch } from "../rules";
import { chatBody } from "./schemas";
import { deleteChatMessage, findChatMessage, sendChatMessage } from "./service";

/**
 * The screen keeps itself up to date by polling, so these only revalidate
 * what shows the chat from outside: the card and the timeline on the job.
 */
function refresh(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
}

export async function sendChatMessageAction(jobId: string, _prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const { ctx, job } = await requireJobContext(jobId, "chat.create");
  const t = await getTranslations("jobs");
  if (!can(ctx, "chat.read")) return { error: t("chat.notAllowed") };

  const outcome = await sendChatMessage(ctx, job.id, chatBody(formData.get("body")), parseUploads(formData.get("attachments")));
  if (!outcome.ok) return { error: t(outcome.reason === "empty" ? "chat.emptyMessage" : "board.filesRefused") };

  refresh(job.id);
  return { message: t("chat.sent") };
}

/** Own messages with `chat.delete`; anybody else's needs `jobs.moderate` too. */
export async function deleteChatMessageAction(messageId: string): Promise<JobActionState> {
  const t = await getTranslations("jobs.chat");
  const base = await requireCompanyContext();
  const message = await findChatMessage(base, messageId);
  if (!message) return { error: t("notAllowed") };
  const { ctx } = await requireJobContext(message.jobId, "chat.delete");
  if (!can(ctx, "chat.read") || !canTouch(ctx.user.id, ctx.permissions, "chat.delete", message.authorId)) {
    return { error: t("notAllowed") };
  }

  await deleteChatMessage(ctx, message);
  refresh(message.jobId);
  return { message: t("deleted") };
}
