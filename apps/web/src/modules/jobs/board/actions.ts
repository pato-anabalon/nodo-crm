"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext, requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { requireJobContext } from "../access";
import { canTouch } from "../rules";
import type { JobActionState } from "../actions";
import { commentSchema, idsFrom, notifyModeFrom, parseUploads, postCategorySchema, postSchema } from "./schemas";
import {
  createComment,
  createPost,
  createPostCategory,
  deletePost,
  deletePostCategory,
  findPost,
  updatePost,
} from "./service";

function refresh(jobId: string, postId?: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/messages`);
  if (postId) revalidatePath(`/jobs/${jobId}/messages/${postId}`);
}

function postValues(formData: FormData) {
  return postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    categoryId: formData.get("categoryId"),
  });
}

/** Both buttons post the same form; which one was pressed is `intent`. */
function wantsPublish(formData: FormData): boolean {
  return formData.get("intent") !== "draft";
}

function notifyOptions(formData: FormData) {
  return { notify: notifyModeFrom(formData.get("notify")), notifyUserIds: idsFrom(formData.getAll("notifyUserId")) };
}

export async function createPostAction(
  jobId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "messages.create");
  const t = await getTranslations();
  if (!can(ctx, "messages.read")) return { error: t("jobs.board.notAllowed") };

  const parsed = postValues(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await createPost(ctx, jobId, parsed.data, {
    publish: wantsPublish(formData),
    uploads: parseUploads(formData.get("attachments")),
    ...notifyOptions(formData),
  });
  if (!outcome.ok) return { error: t("jobs.board.filesRefused") };

  refresh(jobId, outcome.postId);
  redirect(`/jobs/${jobId}/messages/${outcome.postId}`);
}

/**
 * The guard for anything done to a post that exists: the post as this person
 * may see it (somebody else's draft doesn't exist for them), its own job —
 * read from the row, never from the form — the tool, and own-or-moderator.
 */
async function postGuard(postId: string, permission: "messages.update" | "messages.delete") {
  const base = await requireCompanyContext();
  const post = await findPost(base, postId);
  if (!post) return null;
  const { ctx } = await requireJobContext(post.jobId, permission);
  if (!can(ctx, "messages.read")) return null;
  if (!canTouch(ctx.user.id, ctx.permissions, permission, post.authorId)) return null;
  return { ctx, post };
}

export async function updatePostAction(
  postId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await postGuard(postId, "messages.update");
  if (!guarded) return { error: t("jobs.board.notAllowed") };

  const parsed = postValues(formData);
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await updatePost(guarded.ctx, guarded.post, parsed.data, {
    publish: wantsPublish(formData),
    uploads: parseUploads(formData.get("attachments")),
    removeFileIds: idsFrom(formData.getAll("removeFileId")),
    ...notifyOptions(formData),
  });
  if (!outcome.ok) return { error: t("jobs.board.filesRefused") };

  refresh(guarded.post.jobId, postId);
  redirect(`/jobs/${guarded.post.jobId}/messages/${postId}`);
}

export async function deletePostAction(postId: string): Promise<JobActionState> {
  const t = await getTranslations("jobs.board");
  const guarded = await postGuard(postId, "messages.delete");
  if (!guarded) return { error: t("notAllowed") };

  await deletePost(guarded.ctx, guarded.post.jobId, postId);
  refresh(guarded.post.jobId);
  redirect(`/jobs/${guarded.post.jobId}/messages`);
}

/** Comments go on published posts only: a draft is still its author's to think about. */
export async function createCommentAction(
  postId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const t = await getTranslations();
  const base = await requireCompanyContext();
  const post = await findPost(base, postId);
  if (!post || !post.publishedAt) return { error: t("jobs.board.notAllowed") };
  const { ctx } = await requireJobContext(post.jobId, "comments.create");
  if (!can(ctx, "messages.read")) return { error: t("jobs.board.notAllowed") };

  const parsed = commentSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await createComment(ctx, post, parsed.data.body, parseUploads(formData.get("attachments")));
  if (!outcome.ok) return { error: t(outcome.reason === "empty" ? "jobs.board.commentEmpty" : "jobs.board.filesRefused") };

  refresh(post.jobId, postId);
  return { message: t("jobs.board.commented") };
}

// ---------------------------------------------------------------------------
// Categories — the company's, so they are settings
// ---------------------------------------------------------------------------

export async function createPostCategoryAction(_prev: JobActionState, formData: FormData): Promise<JobActionState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = postCategorySchema.safeParse({ emoji: formData.get("emoji"), name: formData.get("name") });
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const outcome = await createPostCategory(ctx, parsed.data.emoji, parsed.data.name);
  if (!outcome.ok) return { fieldErrors: { name: [t("postCategories.duplicate")] } };

  revalidatePath("/settings/post-categories");
  return { message: t("postCategories.added") };
}

export async function deletePostCategoryAction(id: string): Promise<JobActionState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("postCategories");

  await deletePostCategory(ctx, id);
  revalidatePath("/settings/post-categories");
  return { message: t("deleted") };
}
