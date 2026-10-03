"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { File, FileImage, FileText, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { FilePicker } from "@/components/file-picker";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/modules/documents/constants";
import type { QuoteActionState } from "./actions";

export type AttachmentRow = {
  id: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
};

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/** Which icon stands for a file — scoped to what `ACCEPT` above actually
 * offers today, plus a generic fallback rather than icons for formats
 * nothing can upload yet. */
function fileIcon(contentType: string) {
  if (contentType === "application/pdf") return FileText;
  if (contentType.startsWith("image/")) return FileImage;
  return File;
}

/** The icon already says what it is — the name doesn't need to repeat the
 * extension, and a long one is cut rather than left to push the box wide or
 * wrap awkwardly in a half-width column. */
function displayFileName(name: string, max = 30): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.length > max ? `${base.slice(0, max)}...` : base;
}

/**
 * A quote's own attachments, or — with `sectionId` — one section's. Both go
 * through the same action and the same table, just scoped differently, so
 * this is one component rather than a copy of it for the section case.
 *
 * `compact` drops the surrounding `Card`: the top-level list already sits in
 * its own card on the quote's page, but inline inside a section's own row in
 * the editor, a second nested card would be one frame too many. It also
 * changes *how* the file is sent — see `CompactUpload` below for why.
 */
export function AttachmentsManager({
  quoteId,
  sectionId = null,
  attachments,
  canManage,
  formatLocale,
  compact = false,
  uploadAction,
  deleteAction,
}: {
  quoteId: string;
  sectionId?: string | null;
  attachments: AttachmentRow[];
  canManage: boolean;
  formatLocale: string;
  compact?: boolean;
  /**
   * Server Actions, passed down rather than imported here directly — this
   * component is rendered inline inside `QuoteForm`, a client component, and
   * importing a `"use server"` module there pulls in everything else it
   * imports too. Harmless in a real Next.js build (compiled down to an RPC
   * stub), but it breaks this component's Jest tests, which don't have that
   * build step to erase the server-only code behind it.
   */
  uploadAction: (
    quoteId: string,
    sectionId: string | null,
    prev: QuoteActionState,
    formData: FormData,
  ) => Promise<QuoteActionState>;
  deleteAction: (quoteId: string, attachmentId: string) => Promise<QuoteActionState>;
}) {
  const t = useTranslations("quotes.attachments");
  const [state, formAction, formUploading] = useActionState<QuoteActionState, FormData>(
    (prev, formData) => uploadAction(quoteId, sectionId, prev, formData),
    {},
  );
  const [pending, startTransition] = useTransition();

  // This component can stay mounted with its own React state across a
  // `revalidatePath` — inside the quote editor it's a child of a client
  // component holding its own `sections` state, which doesn't refresh from
  // new props the way a server component's children would. So the list it
  // shows is its own, seeded from the prop and then kept up to date directly
  // from what each action actually did, rather than trusted to arrive again
  // from outside.
  const [items, setItems] = useState(attachments);
  // What `items` was last adjusted for — conditional `setState` during
  // render is how React wants a prop change mirrored into state; an effect
  // would mean reacting to a state update that already happened.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.attachment) {
      setItems((current) => [...current, state.attachment!]);
    }
  }

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
  }, [state]);

  function onDelete(attachment: AttachmentRow) {
    startTransition(async () => {
      const result = await deleteAction(quoteId, attachment.id);
      if (result.error) toast.error(result.error);
      else setItems((current) => current.filter((a) => a.id !== attachment.id));
    });
  }

  // Outside a `compact` mount, pressing the compact upload button runs this
  // directly instead of going through `formAction` — see `CompactUpload`.
  function onCompactUpload(file: File) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadAction(quoteId, sectionId, {}, formData);
      if (result.error) toast.error(result.error);
      else {
        if (result.message) toast.success(result.message);
        if (result.attachment) setItems((current) => [...current, result.attachment!]);
      }
    });
  }

  const fieldId = sectionId ? `attachment-${sectionId}` : "attachment";

  const list =
    items.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t("empty")}</p>
    ) : (
      <ul className="space-y-2">
        {items.map((attachment) => (
          <li key={attachment.id} className="flex items-center gap-3 rounded-md border p-3">
            <FileText className="size-4 shrink-0 text-muted-foreground" />

            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm hover:underline"
            >
              {attachment.name}
            </a>

            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatBytes(attachment.size, formatLocale)}
            </span>

            {canManage ? (
              <ConfirmButton
                disabled={pending}
                title={t("deleteTitle")}
                // Names the file: "delete this?" tells you nothing you can
                // check, and the wrong click costs a file somebody has to
                // find and upload again.
                description={t("deleteConfirm", { name: attachment.name })}
                confirmLabel={t("delete")}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={`${t("delete")} ${attachment.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
                onConfirm={() => onDelete(attachment)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    );

  if (compact) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{t("title")}</Label>
        {/* Upload on the left at a fixed share, the list filling the rest —
            the list is what grows with use, not the upload control. */}
        <div className="grid grid-cols-[35%_1fr] gap-4">
          {canManage ? (
            <div className="space-y-2">
              <Label htmlFor={fieldId} className="text-xs">
                {t("upload")}
              </Label>
              <CompactUpload
                id={fieldId}
                accept={ACCEPT}
                chooseLabel={t("choose")}
                noneChosenLabel={t("noneChosen")}
                submitLabel={t("submit")}
                pendingLabel={t("uploading")}
                pending={pending}
                onUpload={onCompactUpload}
              />
              <p className="text-xs text-muted-foreground">{t("hint")}</p>
            </div>
          ) : (
            <div />
          )}

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            // Two across so a section with several files doesn't push the
            // row taller than it needs to — each box is half this column.
            <ul className="grid grid-cols-2 gap-2">
              {items.map((attachment) => {
                const Icon = fileIcon(attachment.contentType);
                return (
                  <li
                    key={attachment.id}
                    className="flex min-w-0 items-center gap-2 rounded-md border p-2"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />

                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={attachment.name}
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      {displayFileName(attachment.name)}
                    </a>

                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatBytes(attachment.size, formatLocale)}
                    </span>

                    {canManage ? (
                      <ConfirmButton
                        disabled={pending}
                        title={t("deleteTitle")}
                        description={t("deleteConfirm", { name: attachment.name })}
                        confirmLabel={t("delete")}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0"
                            aria-label={`${t("delete")} ${attachment.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        onConfirm={() => onDelete(attachment)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {list}

          {canManage ? (
            <form action={formAction} className="space-y-2">
              <Label htmlFor={fieldId}>{t("upload")}</Label>

              <FilePicker
                id={fieldId}
                name="file"
                accept={ACCEPT}
                chooseLabel={t("choose")}
                noneChosenLabel={t("noneChosen")}
                submitLabel={t("submit")}
                pendingLabel={t("uploading")}
                pending={formUploading}
              />

              <p className="text-xs text-muted-foreground">{t("hint")}</p>
            </form>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * `FilePicker` posts through a real `<form>`, which is exactly what can't
 * exist here: a section's attachments sit inside the quote form's own big
 * `<form>`, and HTML has no such thing as a nested one — the browser doesn't
 * just ignore it, it emits a hydration mismatch and then genuinely misfires
 * the submit event between the two.
 *
 * Same look and the same two-step "choose, then send" shape as `FilePicker`,
 * but the second step calls the Server Action directly instead of relying on
 * a `<form>` to carry it, so there's no HTML to misnest. The cost is the one
 * thing `FilePicker` gets for free from being a real form: it has to clear
 * the chosen file itself, imperatively, rather than on a native `reset`
 * event — fine here, since clearing only ever follows one specific click
 * this component made itself.
 */
function CompactUpload({
  id,
  accept,
  chooseLabel,
  noneChosenLabel,
  submitLabel,
  pendingLabel,
  pending,
  onUpload,
}: {
  id: string;
  accept: string;
  chooseLabel: string;
  noneChosenLabel: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Paperclip className="size-4" />
        {chooseLabel}
      </Button>

      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {file?.name ?? noneChosenLabel}
      </span>

      <Button
        type="button"
        size="sm"
        disabled={pending || !file}
        onClick={() => {
          if (!file) return;
          onUpload(file);
          setFile(null);
          if (inputRef.current) inputRef.current.value = "";
        }}
      >
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}
