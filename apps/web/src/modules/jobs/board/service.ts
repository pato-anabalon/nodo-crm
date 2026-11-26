import type { CompanyContext } from "@/lib/auth/session";
import { JobActivityType, NotificationKind } from "@/generated/prisma/client";
import { BOARDS, boardPath, type JobBoard } from "@nodo/core/jobs/boards";
import { notifyEach } from "@/modules/notifications/inbox";
import { emailJobNotice } from "../emails";
import { attachFiles, deleteStored, detachFiles, jobFileSelect, type UploadedFile } from "../files-service";
import { logJobActivity } from "../service";
import { jobName, readersAmong } from "../recipients";
import { addComment, commenters, commentThreadArgs, notifyConversation, type CommentOutcome } from "../comments/service";
import { commentHref } from "../comments/subject";
import { excerptOf } from "./excerpt";
import type { NotifyMode, PostValues } from "./schemas";

/**
 * The Message Board and the confidential board: posts, the drafts behind them
 * and the comments under them. The two work alike, so they are one table and
 * one module, and every lookup says which board it reads — a confidential post
 * answering a Message Board query is a contract shown to the crew.
 * `board-isolation.test.ts` reads this file and fails on a query that doesn't.
 *
 * Every function takes the `jobId` the caller confirmed through
 * `requireJobContext` — for anything inside the job, the one read from the
 * row itself — and every lookup is filtered by it.
 */

const personSelect = { id: true, name: true, email: true, image: true } as const;
const categorySelect = { id: true, key: true, name: true, emoji: true } as const;

/**
 * What one person may see of a job's posts: everything published, and their
 * own drafts. Nobody else's draft — not even a moderator's eye reaches it,
 * because a draft is somebody still deciding what to say.
 */
function visiblePosts(ctx: CompanyContext) {
  return { OR: [{ publishedAt: { not: null } }, { authorId: ctx.user.id }] };
}

/** What a list on one board shows: what is out, on that board. */
function published(jobId: string, board: JobBoard) {
  return { jobId, board, publishedAt: { not: null } };
}

export async function listPostCategories(ctx: CompanyContext) {
  return ctx.db.jobPostCategory.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: categorySelect });
}

export async function listPosts(ctx: CompanyContext, jobId: string, board: JobBoard, categoryId: string | null) {
  const posts = await ctx.db.jobPost.findMany({
    where: { ...published(jobId, board), ...(categoryId ? { categoryId } : {}) },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      publishedAt: true,
      author: { select: personSelect },
      category: { select: categorySelect },
      _count: { select: { comments: true, files: true } },
    },
  });
  // The list shows a line of each post, not the post: the HTML stays here.
  return posts.map(({ body, ...post }) => ({ ...post, excerpt: excerptOf(body) }));
}

export type PostListRow = Awaited<ReturnType<typeof listPosts>>[number];

export async function myDrafts(ctx: CompanyContext, jobId: string, board: JobBoard) {
  return ctx.db.jobPost.findMany({
    where: { jobId, board, publishedAt: null, authorId: ctx.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
}

/** The latest few, for the card on the job's page. */
export async function latestPosts(ctx: CompanyContext, jobId: string, board: JobBoard, take = 3) {
  const [posts, count] = await Promise.all([
    ctx.db.jobPost.findMany({
      where: published(jobId, board),
      orderBy: { publishedAt: "desc" },
      take,
      select: {
        id: true,
        title: true,
        publishedAt: true,
        author: { select: personSelect },
        category: { select: categorySelect },
        _count: { select: { comments: true } },
      },
    }),
    ctx.db.jobPost.count({ where: published(jobId, board) }),
  ]);
  return { posts, count };
}

export async function getPost(ctx: CompanyContext, jobId: string, board: JobBoard, postId: string) {
  return ctx.db.jobPost.findFirst({
    where: { id: postId, jobId, board, ...visiblePosts(ctx) },
    select: {
      id: true,
      jobId: true,
      board: true,
      title: true,
      body: true,
      authorId: true,
      publishedAt: true,
      editedAt: true,
      createdAt: true,
      author: { select: personSelect },
      category: { select: categorySelect },
      files: { orderBy: { createdAt: "asc" }, select: jobFileSelect },
      comments: commentThreadArgs,
    },
  });
}

export type PostDetail = NonNullable<Awaited<ReturnType<typeof getPost>>>;

/**
 * A post as the guards need it: whose job, whose post, which board, whether
 * it is out. The one lookup on any board, because a guard finds the post
 * before it knows which permission to ask for — and then asks the board's.
 */
export async function findPost(ctx: CompanyContext, postId: string) {
  return ctx.db.jobPost.findFirst({
    where: { id: postId, ...visiblePosts(ctx) },
    select: { id: true, jobId: true, board: true, authorId: true, title: true, publishedAt: true },
  });
}

/** A category id from a form counts only if it is one of this company's. */
async function categoryOrNull(ctx: CompanyContext, categoryId: string | null | undefined): Promise<string | null> {
  if (!categoryId) return null;
  const found = await ctx.db.jobPostCategory.findFirst({ where: { id: categoryId }, select: { id: true } });
  return found?.id ?? null;
}

export type PostOutcome = { ok: true; postId: string } | { ok: false; reason: "files" };

/**
 * Writes a new post — published straight away, or kept as a draft. If an
 * attachment is refused the post is taken back out, so a bad file leaves no
 * half-made post behind and nothing reaches the timeline.
 */
export async function createPost(
  ctx: CompanyContext,
  jobId: string,
  board: JobBoard,
  values: PostValues,
  options: { publish: boolean; uploads: UploadedFile[]; notify: NotifyMode; notifyUserIds: string[] },
): Promise<PostOutcome> {
  const post = await ctx.db.jobPost.create({
    data: {
      companyId: ctx.company.id,
      jobId,
      board,
      title: values.title,
      body: values.body,
      categoryId: await categoryOrNull(ctx, values.categoryId),
      authorId: ctx.user.id,
    },
    select: { id: true },
  });

  if (!(await attachFiles(ctx, jobId, { postId: post.id }, options.uploads))) {
    await ctx.db.jobPost.deleteMany({ where: { id: post.id } });
    return { ok: false, reason: "files" };
  }

  if (options.publish) await publish(ctx, { id: post.id, jobId, board }, values.title, options);
  return { ok: true, postId: post.id };
}

/**
 * Saves changes to a post. A draft may be published on the way; a published
 * post is marked edited — once it is out, people should be able to tell it
 * changed after they read it.
 */
export async function updatePost(
  ctx: CompanyContext,
  post: { id: string; jobId: string; board: JobBoard; publishedAt: Date | null },
  values: PostValues,
  options: { publish: boolean; uploads: UploadedFile[]; removeFileIds: string[]; notify: NotifyMode; notifyUserIds: string[] },
): Promise<PostOutcome> {
  if (!(await attachFiles(ctx, post.jobId, { postId: post.id }, options.uploads))) return { ok: false, reason: "files" };
  await detachFiles(ctx, { postId: post.id }, options.removeFileIds);

  await ctx.db.jobPost.update({
    where: { id: post.id },
    data: {
      title: values.title,
      body: values.body,
      categoryId: await categoryOrNull(ctx, values.categoryId),
      ...(post.publishedAt ? { editedAt: new Date() } : {}),
    },
  });

  if (!post.publishedAt && options.publish) await publish(ctx, post, values.title, options);
  return { ok: true, postId: post.id };
}

/** A draft going out: the moment it reaches the timeline and anybody's bell. */
async function publish(
  ctx: CompanyContext,
  post: { id: string; jobId: string; board: JobBoard },
  title: string,
  options: { notify: NotifyMode; notifyUserIds: string[] },
) {
  const { id: postId, jobId, board } = post;
  // Only the first publish counts: two presses of the button raise one line
  // and one round of notices, not two.
  const { count } = await ctx.db.jobPost.updateMany({ where: { id: postId, board, publishedAt: null }, data: { publishedAt: new Date() } });
  if (count === 0) return;
  await logJobActivity(ctx, jobId, JobActivityType[BOARDS[board].published], { postId, title });

  if (options.notify === "nobody") return;
  const members = await ctx.db.jobMember.findMany({
    where: {
      jobId,
      ...(options.notify === "followers" ? { following: true } : { userId: { in: options.notifyUserIds } }),
    },
    select: { userId: true },
  });
  const recipients = await readersAmong(
    ctx,
    members.map((member) => member.userId).filter((id) => id !== ctx.user.id),
    BOARDS[board].read,
  );
  if (recipients.length === 0) return;

  const params = { by: ctx.user.name ?? ctx.user.email, job: await jobName(ctx, jobId), title };
  const raised = await notifyEach(recipients, {
    companyId: ctx.company.id,
    kind: NotificationKind.JOB_POST,
    params,
    href: boardPath(jobId, board, postId),
  });
  emailJobNotice(ctx, { userIds: raised, template: "post", params, path: boardPath(jobId, board, postId) });
}

/**
 * Deletes a post with its comments and every file attached to either. The
 * rows go first and the stored files after; the post's lines leave the
 * timeline with it, since they would lead nowhere.
 */
export async function deletePost(ctx: CompanyContext, jobId: string, postId: string): Promise<void> {
  const files = await ctx.db.jobFile.findMany({
    where: { jobId, OR: [{ postId }, { comment: { postId } }] },
    select: { url: true, thumbnailUrl: true },
  });
  await ctx.db.jobPost.deleteMany({ where: { id: postId, jobId } });
  await ctx.db.jobActivity.deleteMany({ where: { jobId, params: { path: ["postId"], equals: postId } } });
  await deleteStored(files);
}

/**
 * A comment on a published post. Heard about by whoever is already in the
 * conversation — the post's author and everybody who has commented — not by
 * the whole job: a reply is for the people talking.
 */
export async function createComment(
  ctx: CompanyContext,
  post: { id: string; jobId: string; board: JobBoard; title: string; authorId: string | null },
  body: string,
  uploads: UploadedFile[],
): Promise<CommentOutcome> {
  const outcome = await addComment(ctx, post.jobId, { postId: post.id }, body, uploads);
  if (!outcome.ok) return outcome;

  await logJobActivity(ctx, post.jobId, JobActivityType[BOARDS[post.board].commented], {
    postId: post.id,
    commentId: outcome.commentId,
    title: post.title,
  });
  await notifyConversation(ctx, {
    jobId: post.jobId,
    people: [post.authorId, ...(await commenters(ctx, { postId: post.id }))],
    permission: BOARDS[post.board].read,
    title: post.title,
    href: commentHref(post.jobId, { kind: "post", id: post.id, board: post.board }, outcome.commentId),
  });
  return outcome;
}

/**
 * Everybody on the job who reads this board, but the person writing — who
 * "only the people I pick" picks from. Offering somebody who can't open the
 * post would be offering a notice nobody sends.
 */
export async function otherMembers(ctx: CompanyContext, jobId: string, board: JobBoard) {
  const members = await ctx.db.jobMember.findMany({
    where: { jobId, userId: { not: ctx.user.id } },
    orderBy: { createdAt: "asc" },
    select: { user: { select: personSelect } },
  });
  const readers = new Set(await readersAmong(ctx, members.map((member) => member.user.id), BOARDS[board].read));
  return members.map((member) => member.user).filter((user) => readers.has(user.id));
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function postCategoriesWithUse(ctx: CompanyContext) {
  return ctx.db.jobPostCategory.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { ...categorySelect, _count: { select: { posts: true } } },
  });
}

export type CategoryOutcome = { ok: true } | { ok: false; reason: "duplicate" };

/** A company's own category, after the ones it already has. */
export async function createPostCategory(ctx: CompanyContext, emoji: string, name: string): Promise<CategoryOutcome> {
  const clash = await ctx.db.jobPostCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) return { ok: false, reason: "duplicate" };
  const last = await ctx.db.jobPostCategory.aggregate({ _max: { position: true } });
  await ctx.db.jobPostCategory.create({
    data: { companyId: ctx.company.id, emoji, name, position: (last._max.position ?? -1) + 1 },
  });
  return { ok: true };
}

/** Its posts stay, uncategorised (`SetNull`): deleting a label must not delete what it labelled. */
export async function deletePostCategory(ctx: CompanyContext, id: string): Promise<boolean> {
  const { count } = await ctx.db.jobPostCategory.deleteMany({ where: { id } });
  return count > 0;
}
