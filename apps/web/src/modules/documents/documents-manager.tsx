"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/confirm-button";
import { FilePicker } from "@/components/file-picker";
import { Label } from "@/components/ui/label";
import { formatBytes } from "./constants";
import {
  deleteDocumentAction,
  setDefaultDocumentAction,
  uploadDocumentAction,
  type DocumentActionState,
} from "./actions";

export type DocumentRow = {
  id: string;
  name: string;
  url: string;
  size: number;
  isDefault: boolean;
};

export function DocumentsManager({
  documents,
  canManage,
  formatLocale,
}: {
  documents: DocumentRow[];
  canManage: boolean;
  formatLocale: string;
}) {
  const t = useTranslations("documents");
  const [state, formAction, uploading] = useActionState<DocumentActionState, FormData>(
    uploadDocumentAction,
    {},
  );
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  function run(fn: () => Promise<DocumentActionState>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card>
          <CardContent className="pt-6">
            <form ref={formRef} action={formAction} className="space-y-2">
              <Label htmlFor="file">{t("upload")}</Label>

              <FilePicker
                id="file"
                name="file"
                accept="application/pdf"
                chooseLabel={t("choose")}
                noneChosenLabel={t("noneChosen")}
                submitLabel={t("upload")}
                pendingLabel={t("uploading")}
                pending={uploading}
              />

              <p className="text-xs text-muted-foreground">{t("hint")}</p>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-4"
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatBytes(doc.size, formatLocale)}
                </p>
              </div>

              {doc.isDefault ? <Badge>{t("default")}</Badge> : null}

              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="sm">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    {t("view")}
                  </a>
                </Button>

                {canManage && !doc.isDefault ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => setDefaultDocumentAction(doc.id))}
                  >
                    <Star className="size-4" />
                    {t("setDefault")}
                  </Button>
                ) : null}

                {canManage ? (
                  <ConfirmButton
                    disabled={pending}
                    title={t("deleteTitle")}
                    // Says what it actually costs. The quote links the document
                    // rather than keeping a copy (`termsDocument`, `SetNull`), so
                    // deleting it takes the terms off quotes the customer already
                    // has open — not just off the next one.
                    description={t("deleteConfirm", { name: doc.name })}
                    confirmLabel={t("delete")}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`${t("delete")} ${doc.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    onConfirm={() => run(() => deleteDocumentAction(doc.id))}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
