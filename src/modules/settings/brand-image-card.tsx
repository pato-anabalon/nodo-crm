"use client";

import { useActionState, useEffect, useRef, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { FilePicker } from "@/components/file-picker";
import { Label } from "@/components/ui/label";
import { ACCEPTED_IMAGE_TYPES, type BrandImage } from "./brand-image";
import type { SettingsState } from "./actions";

/** The words differ between the two cards; nothing else does. */
export type BrandImageLabels = {
  title: string;
  subtitle: string;
  upload: string;
  choose: string;
  noneChosen: string;
  save: string;
  uploading: string;
  hint: string;
  remove: string;
  removeTitle: string;
  removeConfirm: string;
};

/**
 * Upload, preview and remove for one of the company's two images.
 *
 * The logo and the watermark are the same screen with different words and a
 * different preview, so they are one component: the wiring that is easy to get
 * subtly wrong — the toast, the confirmation, the picker that clears itself —
 * exists once.
 *
 * The preview is passed in rather than derived, because the two differ in what
 * "none" looks like: a company with no logo still shows its initials
 * everywhere, and a company with no watermark simply has none.
 */
export function BrandImageCard({
  kind,
  preview,
  hasImage,
  canManage,
  uploadAction,
  removeAction,
  labels,
}: {
  kind: BrandImage;
  preview: ReactNode;
  hasImage: boolean;
  canManage: boolean;
  uploadAction: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  removeAction: () => Promise<SettingsState>;
  labels: BrandImageLabels;
}) {
  const [state, formAction, uploading] = useActionState<SettingsState, FormData>(
    uploadAction,
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

  function remove() {
    startTransition(async () => {
      const result = await removeAction();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{labels.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          {preview}

          {hasImage && canManage ? (
            <ConfirmButton
              disabled={pending || uploading}
              title={labels.removeTitle}
              // Names where it disappears from: removing is not a tidy-up
              // inside settings, it changes what the customer opens.
              description={labels.removeConfirm}
              confirmLabel={labels.remove}
              trigger={
                <Button variant="ghost" size="sm">
                  <Trash2 className="size-4" />
                  {labels.remove}
                </Button>
              }
              onConfirm={remove}
            />
          ) : null}
        </div>

        {canManage ? (
          <form ref={formRef} action={formAction} className="min-w-64 flex-1 space-y-2">
            <Label htmlFor={kind}>{labels.upload}</Label>

            <FilePicker
              id={kind}
              name={kind}
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              chooseLabel={labels.choose}
              noneChosenLabel={labels.noneChosen}
              submitLabel={labels.save}
              pendingLabel={labels.uploading}
              pending={uploading || pending}
            />

            <p className="text-xs text-muted-foreground">{labels.hint}</p>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
