"use client";

import { useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Paperclip, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extensionOf, JOB_FILE_ACCEPT, type FileKind } from "../files";
import type { UploadedFile } from "../files-service";
import { DocumentTile } from "../docs/file-browser";
import { Lightbox, type MediaItem } from "../docs/lightbox";
import { UploadProgress, useUploadQueue } from "../docs/upload-queue";

export type Attachment = {
  id: string;
  name: string;
  url: string;
  kind: FileKind;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  sizeLabel: string;
};

/**
 * The files under a post or a comment, the way Basecamp shows them: photos and
 * PDFs as a strip of thumbnails that open in the viewer, anything else as a
 * tile in its program's colour that opens in its own tab.
 */
export function AttachmentGallery({ files, className }: { files: Attachment[]; className?: string }) {
  const media: MediaItem[] = files
    .filter((file) => file.kind !== "document")
    .map((file) => ({ id: file.id, name: file.name, url: file.url, kind: file.kind as MediaItem["kind"], width: file.width, height: file.height }));
  const [open, setOpen] = useState<number | null>(null);
  if (files.length === 0) return null;

  return (
    <>
      <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6", className)}>
        {files.map((file) => (
          <li key={file.id} className="min-w-0">
            <button
              type="button"
              title={file.name}
              onClick={() => {
                const index = media.findIndex((item) => item.id === file.id);
                if (index >= 0) setOpen(index);
                else window.open(file.url, "_blank", "noopener");
              }}
              className="group block w-full overflow-hidden rounded-md border bg-muted text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="relative flex aspect-square items-center justify-center">
                {file.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a small copy made at upload.
                  <img
                    src={file.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className={cn("size-full object-cover", file.kind === "pdf" && "object-top")}
                  />
                ) : (
                  <DocumentTile kind={file.kind} extension={extensionOf(file.name)} />
                )}
                {file.kind === "video" ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/50 p-1.5 text-white">
                      <Play className="size-4 fill-current" />
                    </span>
                  </span>
                ) : null}
              </span>
              <span className="block truncate px-1.5 py-1 text-xs">{file.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <Lightbox items={media} index={open} onIndexChange={setOpen} />
    </>
  );
}

/**
 * Attaching files to a post or a comment being written. They go straight to
 * the store as they are picked — the same pipeline as Docs — and what went up
 * travels with the form as JSON in a hidden field, to be checked and recorded
 * when the post or comment is saved. Files already attached (when editing) can
 * be taken off; those go as `removeFileId`.
 *
 * While anything is still going up the form won't submit: an empty required
 * field stands in the way and says why, so a post can't go out with half its
 * photos missing from it.
 *
 * A file picked and then abandoned with the form stays in the store unlisted:
 * kilobytes, and the price of not making people wait for a save to upload.
 */
export function AttachmentField({
  jobId,
  prefix,
  existing = [],
}: {
  jobId: string;
  prefix: string;
  existing?: Attachment[];
}) {
  const t = useTranslations("jobs.board");
  const tFiles = useTranslations("jobs.files");
  const inputRef = useRef<HTMLInputElement>(null);
  const [added, setAdded] = useState<UploadedFile[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const queue = useUploadQueue({
    jobId,
    prefix,
    onUploaded: (uploads) => setAdded((current) => [...current, ...uploads]),
  });

  function start(files: FileList) {
    if (files.length > 0) queue.start(files);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    start(event.dataTransfer.files);
  }

  const kept = existing.filter((file) => !removed.includes(file.id));

  return (
    <div
      className={cn("relative space-y-2 rounded-md", dragging && "outline-2 outline-dashed outline-primary outline-offset-2")}
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
      <input type="hidden" name="attachments" value={JSON.stringify(added)} readOnly />
      {queue.busy ? (
        <input
          required
          value=""
          onChange={() => undefined}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          ref={(input) => input?.setCustomValidity(t("stillUploading"))}
        />
      ) : null}
      {removed.map((id) => (
        <input key={id} type="hidden" name="removeFileId" value={id} readOnly />
      ))}
      {/* `relative` on the box above is what this sr-only input hangs off. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={JOB_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          if (event.currentTarget.files) start(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      {kept.length > 0 || added.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {kept.map((file) => (
            <Chip
              key={file.id}
              name={file.name}
              thumbnailUrl={file.thumbnailUrl}
              removeLabel={t("removeAttachment", { name: file.name })}
              onRemove={() => setRemoved((current) => [...current, file.id])}
            />
          ))}
          {added.map((file) => (
            <Chip
              key={file.pathname}
              name={file.name}
              thumbnailUrl={file.thumbnail?.url ?? null}
              removeLabel={t("removeAttachment", { name: file.name })}
              onRemove={() => setAdded((current) => current.filter((f) => f.pathname !== file.pathname))}
            />
          ))}
        </ul>
      ) : null}

      <UploadProgress items={queue.items} onRetry={queue.retry} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          {queue.busy ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {queue.busy ? tFiles("uploading") : t("attach")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("attachHint")}</span>
      </div>
    </div>
  );
}

function Chip({
  name,
  thumbnailUrl,
  removeLabel,
  onRemove,
}: {
  name: string;
  thumbnailUrl: string | null;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex max-w-60 items-center gap-2 rounded-md border bg-card py-1 pr-1 pl-1.5 text-xs">
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small copy made at upload.
        <img src={thumbnailUrl} alt="" className="size-7 shrink-0 rounded object-cover object-top" />
      ) : (
        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <Button type="button" variant="ghost" size="icon-sm" className="size-6" onClick={onRemove}>
        <X className="size-3.5" />
        <span className="sr-only">{removeLabel}</span>
      </Button>
    </li>
  );
}
