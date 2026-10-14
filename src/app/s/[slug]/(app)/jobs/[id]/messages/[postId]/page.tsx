import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/rich-text";
import { formatDateTime } from "@/lib/format";
import { requireJobContext } from "@/modules/jobs/access";
import { canTouch } from "@/modules/jobs/rules";
import { PersonAvatar, personName } from "@/modules/jobs/avatars";
import { postCategoryName } from "@/modules/jobs/categories";
import { jobUploadPrefix } from "@/modules/jobs/files";
import { getPost } from "@/modules/jobs/board/service";
import {
  createCommentAction,
  deleteCommentAction,
  deletePostAction,
  updateCommentAction,
} from "@/modules/jobs/board/actions";
import { AttachmentGallery } from "@/modules/jobs/board/attachments";
import { CommentForm, CommentItem } from "@/modules/jobs/board/comments";
import { DeletePostButton } from "@/modules/jobs/board/post-controls";
import { toAttachment } from "@/modules/jobs/board/view";

type Params = { id: string; postId: string };

export async function generateMetadata() {
  const t = await getTranslations("jobs.board");
  return { title: t("title") };
}

export default async function PostPage({ params }: { params: Promise<Params> }) {
  const { id, postId } = await params;
  const { ctx, job } = await requireJobContext(id, "messages.read");
  const post = await getPost(ctx, job.id, postId);
  if (!post) notFound();
  const t = await getTranslations("jobs.board");

  const { formatLocale, timezone } = ctx.company;
  const when = (date: Date) => formatDateTime(date, formatLocale, timezone);
  const prefix = jobUploadPrefix(ctx.company.id, job.id);
  const me = ctx.user.id;
  const mayEdit = canTouch(me, ctx.permissions, "messages.update", post.authorId);
  const mayDelete = canTouch(me, ctx.permissions, "messages.delete", post.authorId);
  const mayComment = Boolean(post.publishedAt) && can(ctx, "comments.create");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={`/jobs/${job.id}/messages`} aria-label={t("backToBoard")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <p className="truncate pt-2 text-sm text-muted-foreground">
          <Link href={`/jobs/${job.id}`} className="hover:underline">
            {job.name}
          </Link>
          {" › "}
          <Link href={`/jobs/${job.id}/messages`} className="hover:underline">
            {t("title")}
          </Link>
        </p>
      </div>

      {!post.publishedAt ? (
        <p className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          {t("draftNotice")}
        </p>
      ) : null}

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
                <Link href={`/jobs/${job.id}/messages/${post.id}/edit`}>
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
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("comments", { count: post.comments.length })}</h2>
          {post.comments.length > 0 ? (
            <ol className="space-y-5">
              {post.comments.map((comment) => {
                const files = comment.files.map((file) => toAttachment(file, formatLocale));
                const commentId = comment.id;
                return (
                  <li key={comment.id} id={`comment-${comment.id}`} className="flex scroll-mt-20 gap-3">
                    {comment.author ? <PersonAvatar person={comment.author} /> : null}
                    <CommentItem
                      header={
                        <p className="text-sm">
                          <span className="font-semibold">{comment.author ? personName(comment.author) : t("someone")}</span>{" "}
                          <span className="text-muted-foreground">
                            {when(comment.createdAt)}
                            {comment.editedAt ? ` · ${t("edited")}` : null}
                          </span>
                        </p>
                      }
                      edit={
                        canTouch(me, ctx.permissions, "comments.update", comment.authorId)
                          ? { action: updateCommentAction.bind(null, commentId), jobId: job.id, prefix, body: comment.body, files }
                          : null
                      }
                      onDelete={
                        canTouch(me, ctx.permissions, "comments.delete", comment.authorId)
                          ? async () => {
                              "use server";
                              return deleteCommentAction(commentId);
                            }
                          : null
                      }
                    >
                      <div className="space-y-3">
                        <RichText html={comment.body} profile="full" className="text-sm" />
                        <AttachmentGallery files={files} />
                      </div>
                    </CommentItem>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {mayComment ? (
            <div className="rounded-xl border bg-card p-4">
              <CommentForm
                action={createCommentAction.bind(null, post.id)}
                jobId={job.id}
                prefix={prefix}
                submitLabel={t("addComment")}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
