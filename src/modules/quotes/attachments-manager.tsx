"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { FilePicker } from "@/components/file-picker";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/modules/documents/constants";
import {
  deleteQuoteAttachmentAction,
  uploadQuoteAttachmentAction,
  type QuoteActionState,
} from "./actions";

export type AttachmentRow = { id: string; name: string; url: string; size: number };

export function AttachmentsManager({
  quoteId,
  attachments,
  canManage,
  formatLocale,
}: {
  quoteId: string;
  attachments: AttachmentRow[];
  canManage: boolean;
  formatLocale: string;
}) {
  const t = useTranslations("quotes.attachments");
  const [state, formAction, uploading] = useActionState<QuoteActionState, FormData>(
    uploadQuoteAttachmentAction.bind(null, quoteId),
    {},
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
  }, [state]);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((attachment) => (
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
                    onConfirm={() =>
                      startTransition(async () => {
                        const result = await deleteQuoteAttachmentAction(quoteId, attachment.id);
                        if (result.error) toast.error(result.error);
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form action={formAction} className="space-y-2">
            <Label htmlFor="attachment">{t("upload")}</Label>

            <FilePicker
              id="attachment"
              name="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              chooseLabel={t("choose")}
              noneChosenLabel={t("noneChosen")}
              submitLabel={t("submit")}
              pendingLabel={t("uploading")}
              pending={uploading}
            />

            <p className="text-xs text-muted-foreground">{t("hint")}</p>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
