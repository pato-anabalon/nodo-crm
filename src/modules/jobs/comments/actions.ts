"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { requireJobContext } from "../access";
import { canTouch } from "../rules";
import type { JobActionState } from "../actions";
import { commentSchema, idsFrom, parseUploads } from "../board/schemas";
import { deleteComment, findComment, updateComment } from "./service";
import { commentSubject, subjectPath, subjectReadPermission, type CommentSubject } from "./subject";

/**
 * Editing and deleting a comment, wherever it is. The guard reads everything
 * off the row: its job, its author, and what it is on — which decides the
 * tool whose read permission it also needs.
 */
async function commentGuard(commentId: string, permission: "comments.update" | "comments.delete") {
  const base = await requireCompanyContext();
  const comment = await findComment(base, commentId);
  const subject = comment ? commentSubject(comment) : null;
  if (!comment || !subject) return null;
  const { ctx } = await requireJobContext(comment.jobId, permission);
  if (!can(ctx, subjectReadPermission(subject))) return null;
  if (!canTouch(ctx.user.id, ctx.permissions, permission, comment.authorId)) return null;
  return { ctx, comment, subject };
}

function refresh(jobId: string, subject: CommentSubject) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(subjectPath(jobId, subject));
  if (subject.kind === "todo" || subject.kind === "list") revalidatePath(`/jobs/${jobId}/todos`);
  if (subject.kind === "event") revalidatePath(`/jobs/${jobId}/schedule`);
}

export async function updateCommentAction(
  commentId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await commentGuard(commentId, "comments.update");
  if (!guarded) return { error: t("jobs.board.notAllowed") };

  const parsed = commentSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await updateComment(
    guarded.ctx,
    guarded.comment,
    parsed.data.body,
    parseUploads(formData.get("attachments")),
    idsFrom(formData.getAll("removeFileId")),
  );
  if (!outcome.ok) return { error: t(outcome.reason === "empty" ? "jobs.board.commentEmpty" : "jobs.board.filesRefused") };

  refresh(guarded.comment.jobId, guarded.subject);
  return { message: t("jobs.board.commentSaved") };
}

export async function deleteCommentAction(commentId: string): Promise<JobActionState> {
  const t = await getTranslations("jobs.board");
  const guarded = await commentGuard(commentId, "comments.delete");
  if (!guarded) return { error: t("notAllowed") };

  await deleteComment(guarded.ctx, guarded.comment.jobId, commentId);
  refresh(guarded.comment.jobId, guarded.subject);
  return { message: t("commentDeleted") };
}
