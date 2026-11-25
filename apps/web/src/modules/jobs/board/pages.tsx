import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, MessageSquare, Paperclip, Pencil, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";
import { elapsedLabel } from "@/lib/elapsed-label";
import { formatDateTime } from "@/lib/format";
import { requireJobContext } from "@/modules/jobs/access";
import { PersonAvatar, personName } from "@/modules/jobs/avatars";
import { postCategoryName } from "@/modules/jobs/categories";
import { CommentThread } from "@/modules/jobs/comments/thread";
import { canTouch } from "@nodo/core/jobs/rules";
import { jobUploadPrefix } from "@nodo/core/jobs/files";
import { BOARDS, boardPath, type JobBoard } from "@nodo/core/jobs/boards";
import { createCommentAction, createPostAction, deletePostAction, updatePostAction } from "./actions";
import { AttachmentGallery } from "./attachments";
import { DeletePostButton } from "./post-controls";
import { PostForm } from "./post-form";
import { getPost, listPostCategories, listPosts, myDrafts, otherMembers } from "./service";
import { categoryLabel, toAttachment } from "./view";

/**
 * The four screens of a board — the list, a new post, a post, editing one —
 * written once for both boards. The routes under `messages/` and
 * `confidential/` only say which board they are; everything else, down to the
 * permission each screen asks for, comes from `BOARDS`.
 */

type Words = Awaited<ReturnType<typeof getTranslations<"jobs.board">>>;

/** The few words that differ between the boards. */
function boardWords(board: JobBoard, t: Words) {
  if (board === "CONFIDENTIAL") {
    return {
      title: t("confidential.title"),
      back: t("confidential.backToBoard"),
      empty: t("confidential.empty"),
      emptyCanPost: t("confidential.emptyCanPost"),
    };
  }
  return { title: t("title"), back: t("backToBoard"), empty: t("empty"), emptyCanPost: t("emptyCanPost") };
}

/** The confidential board says so wherever its posts are read or written. */
function ConfidentialNotice({ board }: { board: JobBoard }) {
  return board === "CONFIDENTIAL" ? <ConfidentialLine /> : null;
}

async function ConfidentialLine() {
  const t = await getTranslations("jobs.board.confidential");
  return (
    <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" />
      {t("notice")}
    </p>
  );
}

export async function boardMetadata(board: JobBoard, page: "list" | "new" | "edit") {
  const t = await getTranslations("jobs.board");
  return { title: page === "new" ? t("newPost") : page === "edit" ? t("editPost") : boardWords(board, t).title };
}

export async function BoardListPage({
  board,
  jobId,
  query,
}: {
  board: JobBoard;
  jobId: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const rules = BOARDS[board];
  const { ctx, job } = await requireJobContext(jobId, rules.read);
  const [t, tElapsed] = await Promise.all([getTranslations("jobs.board"), getTranslations("common.elapsed")]);
  const words = boardWords(board, t);

  const categories = await listPostCategories(ctx);
  // An id that isn't one of the company's categories reads as "all" rather than as an empty board.
  const categoryId =
    typeof query.category === "string" && categories.some((c) => c.id === query.category) ? query.category : null;
  const [posts, drafts] = await Promise.all([listPosts(ctx, job.id, board, categoryId), myDrafts(ctx, job.id, board)]);

  const ago = (date: Date) => elapsedLabel(date, tElapsed, ctx.company.formatLocale, ctx.company.timezone);
  const name = (category: { key: string | null; name: string | null }) => postCategoryName(category, t);
  const base = boardPath(job.id, board);
  const mayPost = can(ctx, rules.create);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/jobs/${job.id}`} aria-label={t("backToJob", { name: job.name })}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {board === "CONFIDENTIAL" ? <Lock className="size-5 text-muted-foreground" /> : null}
              {words.title}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{job.name}</p>
          </div>
        </div>
        {mayPost ? (
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus className="size-4" />
              {t("newPost")}
            </Link>
          </Button>
        ) : null}
      </div>

      <ConfidentialNotice board={board} />

      {drafts.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-dashed p-4">
          <h2 className="text-sm font-semibold">{t("yourDrafts", { count: drafts.length })}</h2>
          <ul className="space-y-1 text-sm">
            {drafts.map((draft) => (
              <li key={draft.id} className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`${base}/${draft.id}`} className="font-medium hover:underline">
                  {draft.title}
                </Link>
                <span className="text-xs text-muted-foreground">{t("draftSaved", { when: ago(draft.updatedAt) })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {categories.length > 0 ? (
        <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-1.5">
          {[null, ...categories].map((category) => {
            const active = (category?.id ?? null) === categoryId;
            return (
              <Link
                key={category?.id ?? "all"}
                href={category ? `${base}?category=${category.id}` : base}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "border-foreground/30 bg-muted text-foreground",
                )}
              >
                {category ? `${category.emoji} ${name(category)}` : t("allCategories")}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm italic text-muted-foreground">
          {categoryId ? t("emptyCategory") : mayPost ? words.emptyCanPost : words.empty}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`${base}/${post.id}`} className="flex gap-3 p-4 transition-colors hover:bg-accent/40">
                {post.author ? <PersonAvatar person={post.author} /> : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    {post.category ? (
                      <span className="text-xs text-muted-foreground">
                        {post.category.emoji} {name(post.category)}
                      </span>
                    ) : null}
                    <span className="font-semibold">{post.title}</span>
                  </p>
                  {post.excerpt ? <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p> : null}
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {post.author ? personName(post.author) : t("someone")} · {post.publishedAt ? ago(post.publishedAt) : null}
                    </span>
                    {post._count.comments > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3.5" />
                        {post._count.comments}
                      </span>
                    ) : null}
                    {post._count.files > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="size-3.5" />
                        {post._count.files}
                      </span>
                    ) : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function NewBoardPostPage({ board, jobId }: { board: JobBoard; jobId: string }) {
  const rules = BOARDS[board];
  const { ctx, job } = await requireJobContext(jobId, rules.create);
  if (!can(ctx, rules.read)) notFound();
  const t = await getTranslations("jobs.board");
  const [categories, people] = await Promise.all([listPostCategories(ctx), otherMembers(ctx, job.id, board)]);
  const back = boardPath(job.id, board);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={back} aria-label={boardWords(board, t).back}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("newPost")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>

      <ConfidentialNotice board={board} />

      <PostForm
        action={createPostAction.bind(null, job.id, board)}
        jobId={job.id}
        prefix={jobUploadPrefix(ctx.company.id, job.id)}
        categories={categories.map((c) => ({ value: c.id, label: categoryLabel(c, postCategoryName(c, t)) }))}
        people={people}
        published={false}
        cancelHref={back}
      />
    </div>
  );
}

export async function BoardPostPage({ board, jobId, postId }: { board: JobBoard; jobId: string; postId: string }) {
  const rules = BOARDS[board];
  const { ctx, job } = await requireJobContext(jobId, rules.read);
  const post = await getPost(ctx, job.id, board, postId);
  if (!post) notFound();
  const t = await getTranslations("jobs.board");
  const words = boardWords(board, t);

  const { formatLocale, timezone } = ctx.company;
  const when = (date: Date) => formatDateTime(date, formatLocale, timezone);
  const me = ctx.user.id;
  const mayEdit = canTouch(me, ctx.permissions, rules.update, post.authorId);
  const mayDelete = canTouch(me, ctx.permissions, rules.delete, post.authorId);
  const mayComment = Boolean(post.publishedAt) && can(ctx, "comments.create");
  const base = boardPath(job.id, board);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={base} aria-label={words.back}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <p className="truncate pt-2 text-sm text-muted-foreground">
          <Link href={`/jobs/${job.id}`} className="hover:underline">
            {job.name}
          </Link>
          {" › "}
          <Link href={base} className="hover:underline">
            {words.title}
          </Link>
        </p>
      </div>

      {!post.publishedAt ? (
        <p className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          {t("draftNotice")}
        </p>
      ) : null}

      <ConfidentialNotice board={board} />

      <article className="space-y-5 rounded-xl border bg-card p-5 sm:p-8">
        <header className="space-y-3 text-center">
          {post.category ? (
            <p className="text-sm text-muted-foreground">
              {post.category.emoji} {postCategoryName(post.category, t)}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{post.title}</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {post.author ? <PersonAvatar person={post.author} size="sm" /> : null}
            <span>
              {post.author ? personName(post.author) : t("someone")} · {when(post.publishedAt ?? post.createdAt)}
              {post.editedAt ? ` · ${t("edited")}` : null}
            </span>
          </div>
        </header>

        <RichText html={post.body} profile="full" className="text-[0.95rem] leading-relaxed" />
        <AttachmentGallery files={post.files.map((file) => toAttachment(file, formatLocale))} />

        {mayEdit || mayDelete ? (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {mayEdit ? (
              <Button asChild variant="outline">
                <Link href={`${base}/${post.id}/edit`}>
                  <Pencil className="size-4" />
                  {post.publishedAt ? t("editPost") : t("editDraft")}
                </Link>
              </Button>
            ) : null}
            {mayDelete ? (
              <DeletePostButton
                title={post.title}
                onDelete={async () => {
                  "use server";
                  return deletePostAction(postId);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </article>

      {post.publishedAt ? (
        <CommentThread
          ctx={ctx}
          jobId={job.id}
          comments={post.comments}
          onCreate={mayComment ? createCommentAction.bind(null, post.id) : null}
        />
      ) : null}
    </div>
  );
}

export async function EditBoardPostPage({ board, jobId, postId }: { board: JobBoard; jobId: string; postId: string }) {
  const rules = BOARDS[board];
  const { ctx, job } = await requireJobContext(jobId, rules.update);
  if (!can(ctx, rules.read)) notFound();
  const post = await getPost(ctx, job.id, board, postId);
  // Somebody else's post without `jobs.moderate` is not theirs to open here.
  if (!post || !canTouch(ctx.user.id, ctx.permissions, rules.update, post.authorId)) notFound();

  const t = await getTranslations("jobs.board");
  const [categories, people] = await Promise.all([listPostCategories(ctx), otherMembers(ctx, job.id, board)]);
  const back = boardPath(job.id, board, post.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={back} aria-label={t("backToPost")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{post.publishedAt ? t("editPost") : t("editDraft")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>

      <ConfidentialNotice board={board} />

      <PostForm
        action={updatePostAction.bind(null, post.id)}
        jobId={job.id}
        prefix={jobUploadPrefix(ctx.company.id, job.id)}
        categories={categories.map((c) => ({ value: c.id, label: categoryLabel(c, postCategoryName(c, t)) }))}
        people={people}
        defaults={{ title: post.title, body: post.body, categoryId: post.category?.id ?? null }}
        existingFiles={post.files.map((file) => toAttachment(file, ctx.company.formatLocale))}
        published={Boolean(post.publishedAt)}
        cancelHref={back}
      />
    </div>
  );
}
