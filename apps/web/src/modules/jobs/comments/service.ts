import type { CompanyContext } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { NotificationKind } from "@/generated/prisma/client";
import { notifyEach } from "@/modules/notifications/inbox";
import { emailJobNotice } from "../emails";
import { attachFiles, deleteStored, detachFiles, jobFileSelect, type UploadedFile } from "../files-service";
import { jobName, recipientsOnJob } from "../recipients";

/**
 * Comments, whatever they are about. What a comment is *on* — a post, a to-do,
 * a list — decides who may read it and where it lives (`subject.ts`); writing,
 * editing and deleting one is the same everywhere, so it is written once.
 */

/** The key a comment hangs off, as the row stores it. */
export type CommentHome = { postId: string } | { todoId: string } | { todoListId: string } | { eventId: string };

export type CommentOutcome = { ok: true; commentId: string } | { ok: false; reason: "files" | "empty" };

/** A comment as the guards need it: whose job, whose comment, on what. */
export async function findComment(ctx: CompanyContext, commentId: string) {
  return ctx.db.jobComment.findFirst({
    where: { id: commentId },
    select: { id: true, jobId: true, postId: true, todoId: true, todoListId: true, eventId: true, authorId: true },
  });
}

/**
 * Writes a comment with its attachments. If an attachment is refused the
 * comment is taken back out, so a bad file leaves nothing half-made behind.
 */
export async function addComment(
  ctx: CompanyContext,
  jobId: string,
  home: CommentHome,
  body: string,
  uploads: UploadedFile[],
): Promise<CommentOutcome> {
  if (!body && uploads.length === 0) return { ok: false, reason: "empty" };

  const comment = await ctx.db.jobComment.create({
    data: { companyId: ctx.company.id, jobId, ...home, body, authorId: ctx.user.id },
    select: { id: true },
  });
  if (!(await attachFiles(ctx, jobId, { commentId: comment.id }, uploads))) {
    await ctx.db.jobComment.deleteMany({ where: { id: comment.id } });
    return { ok: false, reason: "files" };
  }
  return { ok: true, commentId: comment.id };
}

/** The people who have already said something under this. */
export async function commenters(ctx: CompanyContext, home: CommentHome): Promise<string[]> {
  const rows = await ctx.db.jobComment.findMany({
    where: { ...home, authorId: { not: null } },
    select: { authorId: true },
  });
  return rows.map((row) => row.authorId as string);
}

/**
 * A reply is heard about by the people in the conversation — never the whole
 * job — cut to those still on it whose profile reads the tool.
 */
export async function notifyConversation(
  ctx: CompanyContext,
  options: { jobId: string; people: (string | null)[]; permission: Permission; title: string; href: string },
): Promise<void> {
  const recipients = await recipientsOnJob(ctx, options.jobId, options.people, options.permission);
  if (recipients.length === 0) return;
  const params = { by: ctx.user.name ?? ctx.user.email, job: await jobName(ctx, options.jobId), title: options.title };
  const raised = await notifyEach(recipients, {
    companyId: ctx.company.id,
    kind: NotificationKind.JOB_COMMENT,
    params,
    href: options.href,
  });
  emailJobNotice(ctx, { userIds: raised, template: "comment", params, path: options.href });
}

export async function updateComment(
  ctx: CompanyContext,
  comment: { id: string; jobId: string },
  body: string,
  uploads: UploadedFile[],
  removeFileIds: string[],
): Promise<CommentOutcome> {
  const kept = await ctx.db.jobFile.count({ where: { commentId: comment.id, id: { notIn: removeFileIds } } });
  if (!body && uploads.length === 0 && kept === 0) return { ok: false, reason: "empty" };

  if (!(await attachFiles(ctx, comment.jobId, { commentId: comment.id }, uploads))) return { ok: false, reason: "files" };
  await detachFiles(ctx, { commentId: comment.id }, removeFileIds);
  await ctx.db.jobComment.update({ where: { id: comment.id }, data: { body, editedAt: new Date() } });
  return { ok: true, commentId: comment.id };
}

/** Deletes a comment, its files, and its line on the timeline — which would lead nowhere. */
export async function deleteComment(ctx: CompanyContext, jobId: string, commentId: string): Promise<void> {
  const files = await ctx.db.jobFile.findMany({ where: { commentId }, select: { url: true, thumbnailUrl: true } });
  await ctx.db.jobComment.deleteMany({ where: { id: commentId, jobId } });
  await ctx.db.jobActivity.deleteMany({ where: { jobId, params: { path: ["commentId"], equals: commentId } } });
  await deleteStored(files);
}

/** What a comment thread renders from: every comment on a thing, oldest first. */
export const commentThreadArgs = {
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    body: true,
    authorId: true,
    createdAt: true,
    editedAt: true,
    author: { select: { id: true, name: true, email: true, image: true } },
    files: { orderBy: { createdAt: "asc" }, select: jobFileSelect },
  },
} as const;
