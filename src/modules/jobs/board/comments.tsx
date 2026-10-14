"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useActionToast } from "@/lib/use-action-toast";
import type { JobActionState } from "../actions";
import type { FormAction } from "../docs/name-dialogs";
import { AttachmentField, type Attachment } from "./attachments";

/**
 * The box under a post, and the same box when a comment is being edited.
 *
 * On success the box starts over — a new editor and a new attachment field —
 * by changing its key from inside the action, the way a dialog closes itself
 * on success. The editor holds its own text, so resetting the form alone
 * would leave it on screen.
 */
export function CommentForm({
  action,
  jobId,
  prefix,
  defaultBody = "",
  existingFiles,
  submitLabel,
  onDone,
  onCancel,
}: {
  action: FormAction;
  jobId: string;
  prefix: string;
  defaultBody?: string;
  existingFiles?: Attachment[];
  submitLabel: string;
  /** Called once the action succeeded — editing closes, adding starts over. */
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [round, setRound] = useState(0);
  return (
    <CommentFormRound
      key={round}
      action={action}
      jobId={jobId}
      prefix={prefix}
      defaultBody={defaultBody}
      existingFiles={existingFiles}
      submitLabel={submitLabel}
      onCancel={onCancel}
      onDone={() => {
        setRound((n) => n + 1);
        onDone?.();
      }}
    />
  );
}

function CommentFormRound({
  action,
  jobId,
  prefix,
  defaultBody,
  existingFiles,
  submitLabel,
  onDone,
  onCancel,
}: {
  action: FormAction;
  jobId: string;
  prefix: string;
  defaultBody: string;
  existingFiles?: Attachment[];
  submitLabel: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("jobs.board");
  const tCommon = useTranslations("common");
  // The snackbar is raised here, not by the round that follows: a successful
  // round is replaced before an effect in it would get to run.
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.message) {
      toast.success(next.message);
      onDone();
    }
    return next.message ? {} : next;
  }, {});
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-3">
      <RichTextEditor name="body" variant="full" minHeight="sm" defaultValue={defaultBody} ariaLabel={t("comment")} placeholder={t("commentPlaceholder")} />
      {state.fieldErrors?.body ? <p className="text-sm text-destructive">{state.fieldErrors.body[0]}</p> : null}
      <AttachmentField jobId={jobId} prefix={prefix} existing={existingFiles} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tCommon("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * One comment, with what this person may do to it. The body and its files
 * arrive already rendered from the server; editing swaps them for the box.
 */
export function CommentItem({
  header,
  children,
  edit,
  onDelete,
}: {
  header: ReactNode;
  /** The comment as read: its text and its attachments. */
  children: ReactNode;
  edit: {
    action: FormAction;
    jobId: string;
    prefix: string;
    body: string;
    files: Attachment[];
  } | null;
  onDelete: (() => Promise<JobActionState>) | null;
}) {
  const t = useTranslations("jobs.board");
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex items-start justify-between gap-2">
        {header}
        {!editing && (edit || onDelete) ? (
          <div className="flex shrink-0 gap-1">
            {edit ? (
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                <span className="sr-only">{t("editComment")}</span>
              </Button>
            ) : null}
            {onDelete ? (
              <ConfirmButton
                trigger={
                  <Button type="button" variant="ghost" size="icon-sm" disabled={deleting}>
                    <Trash2 className="size-4" />
                    <span className="sr-only">{t("deleteComment")}</span>
                  </Button>
                }
                title={t("deleteCommentTitle")}
                description={t("deleteCommentBody")}
                confirmLabel={t("deleteComment")}
                onConfirm={() =>
                  startDelete(async () => {
                    const result = await onDelete();
                    if (result.error) toast.error(result.error);
                    else if (result.message) toast.success(result.message);
                  })
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {editing && edit ? (
        <CommentForm
          action={edit.action}
          jobId={edit.jobId}
          prefix={edit.prefix}
          defaultBody={edit.body}
          existingFiles={edit.files}
          submitLabel={t("saveComment")}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        children
      )}
    </div>
  );
}
