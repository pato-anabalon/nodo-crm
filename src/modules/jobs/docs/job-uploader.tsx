"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileImage, FileText, FileVideo, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JOB_FILE_ACCEPT } from "../files";
import type { UploadedFile } from "../files-service";
import type { JobActionState } from "../actions";
import { UploadProgress, useUploadQueue } from "./upload-queue";

/**
 * Photos, plans and videos from site, straight from the browser to the store.
 *
 * The upload box of Docs & Files. The work — compressing, retrying, the bars —
 * is `useUploadQueue`'s, shared with posts and comments; what is particular
 * here is that each batch is filed into the folder being looked at, in one
 * go at the end — one line on the timeline for the batch, not one per photo.
 */
export function JobUploader({
  jobId,
  prefix,
  onRegister,
  children,
}: {
  jobId: string;
  /** `companies/<id>/jobs/<id>/`: the route refuses anything outside it. */
  prefix: string;
  onRegister: (uploads: UploadedFile[]) => Promise<JobActionState>;
  /** The listing, shown under the upload box. */
  children?: ReactNode;
}) {
  const t = useTranslations("jobs.files");
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useUploadQueue({
    jobId,
    prefix,
    onUploaded: async (uploads) => {
      const outcome = await onRegister(uploads);
      if (outcome.error) toast.error(outcome.error);
      else if (outcome.message) toast.success(outcome.message);
    },
  });
  const [dragging, setDragging] = useState(false);
  const busy = queue.busy;

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) queue.start(event.dataTransfer.files);
  }

  const browse = () => inputRef.current?.click();

  return (
    <div className="space-y-6">
      <section
        aria-label={t("upload")}
        className="relative space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragging(false);
        }}
        onDrop={onDrop}
      >
        {/* `relative` on the section is what the sr-only input hangs off. */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={JOB_FILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            if (event.currentTarget.files) queue.start(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />

        <div
          className={cn(
            "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 px-4 py-8 text-center transition-colors sm:py-10",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <FileStack />
          <p className="max-w-sm text-lg font-semibold tracking-tight text-balance sm:text-xl">
            {t.rich("dropTitle", { hl: (chunks) => <span className="text-[var(--brand-ink)]">{chunks}</span> })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t.rich("dropBrowse", {
              browse: (chunks) => (
                <button
                  type="button"
                  onClick={browse}
                  className="font-medium text-[var(--brand-ink)] underline underline-offset-4 hover:no-underline"
                >
                  {chunks}
                </button>
              ),
            })}
          </p>
          <p className="text-xs text-muted-foreground">{t("dropHint")}</p>
        </div>

        <UploadProgress items={queue.items} onRetry={queue.retry} />

        <div className="flex justify-center">
          <Button type="button" size="lg" className="min-w-40 rounded-full" onClick={browse} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? t("uploading") : t("upload")}
          </Button>
        </div>
      </section>

      {children}
    </div>
  );
}

/** Three sheets fanned out — a video, a photo, a document: what this box takes. */
function FileStack() {
  const sheet = "absolute flex size-12 items-center justify-center rounded-lg border-2 border-foreground/80 bg-card";
  return (
    <div aria-hidden className="relative h-16 w-28">
      <div className={cn(sheet, "top-2 left-1 -rotate-12")}>
        <FileVideo className="size-5 text-[var(--brand-ink)]" />
      </div>
      <div className={cn(sheet, "top-2 right-1 rotate-12")}>
        <FileText className="size-5 text-[var(--brand-ink)]" />
      </div>
      <div className={cn(sheet, "top-0 left-1/2 z-10 h-14 -translate-x-1/2")}>
        <FileImage className="size-6 text-[var(--brand-ink)]" />
      </div>
    </div>
  );
}
