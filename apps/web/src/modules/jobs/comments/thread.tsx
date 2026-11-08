import { getTranslations } from "next-intl/server";
import type { CompanyContext } from "@/lib/auth/session";
import { RichText } from "@/components/rich-text";
import { formatDateTime } from "@/lib/format";
import { canTouch } from "../rules";
import { PersonAvatar, personName } from "../avatars";
import { jobUploadPrefix } from "../files";
import type { FormAction } from "../docs/name-dialogs";
import { AttachmentGallery } from "../board/attachments";
import { toAttachment } from "../board/view";
import type { JobFileRow } from "../files-service";
import { deleteCommentAction, updateCommentAction } from "./actions";
import { CommentForm, CommentItem } from "./comment-form";

export type ThreadComment = {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; name: string | null; email: string; image: string | null } | null;
  files: JobFileRow[];
};

/**
 * The comments under a post, a to-do or a list, and the box to add one. One
 * component for every place a conversation happens, so the three can't drift
 * apart in who may edit what.
 */
export async function CommentThread({
  ctx,
  jobId,
  comments,
  onCreate,
}: {
  ctx: CompanyContext;
  jobId: string;
  comments: ThreadComment[];
  /** The action that adds a comment here, or null when this person can't. */
  onCreate: FormAction | null;
}) {
  const t = await getTranslations("jobs.board");
  const { formatLocale, timezone } = ctx.company;
  const prefix = jobUploadPrefix(ctx.company.id, jobId);
  const me = ctx.user.id;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t("comments", { count: comments.length })}</h2>
      {comments.length > 0 ? (
        <ol className="space-y-5">
          {comments.map((comment) => {
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
                        {formatDateTime(comment.createdAt, formatLocale, timezone)}
                        {comment.editedAt ? ` · ${t("edited")}` : null}
                      </span>
                    </p>
                  }
                  edit={
                    canTouch(me, ctx.permissions, "comments.update", comment.authorId)
                      ? { action: updateCommentAction.bind(null, commentId), jobId, prefix, body: comment.body, files }
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

      {onCreate ? (
        <div className="rounded-xl border bg-card p-4">
          <CommentForm action={onCreate} jobId={jobId} prefix={prefix} submitLabel={t("addComment")} />
        </div>
      ) : null}
    </section>
  );
}
