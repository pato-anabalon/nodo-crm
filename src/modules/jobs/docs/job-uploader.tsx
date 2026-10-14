"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { AlertCircle, CheckCircle2, FileImage, FileText, FileVideo, Loader2, RotateCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  checkJobFile,
  compressedType,
  IMAGE_MAX_EDGE,
  JOB_FILE_ACCEPT,
  jobFilePathname,
  renameForType,
  shouldCompress,
  THUMBNAIL_EDGE,
  type FileRule,
} from "../files";
import type { UploadedFile } from "../files-service";
import { pdfThumbnail } from "./pdf-thumbnail";
import type { JobActionState } from "../actions";

/** Three at a time: enough to use the line, few enough that one bar on a bad signal still moves. */
const CONCURRENCY = 3;
/** Above this, Blob splits the file into parts uploaded and retried separately. */
const MULTIPART_ABOVE = 50 * 1024 * 1024;
const ATTEMPTS = 3;

type ItemStatus = "waiting" | "preparing" | "uploading" | "done" | "failed";

type Item = {
  key: string;
  file: File;
  name: string;
  status: ItemStatus;
  progress: number;
  /** A message key under `jobs.files.uploadErrors`. */
  error?: string;
};

/**
 * Photos, plans and videos from site, straight from the browser to the store.
 *
 * A phone photo is re-encoded here before it leaves (`browser-image-compression`,
 * in a worker): 6 MB becomes well under one, on a site connection that is the
 * difference between uploading and giving up. A small copy goes up beside it
 * for the galleries. Videos and documents go as they are.
 *
 * Each file has its own bar and its own retries, so one failing on a bad signal
 * doesn't cost the rest. The rows are written in one go at the end — one line
 * on the timeline for the batch, not one per photo.
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
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = items.some((item) => item.status === "waiting" || item.status === "preparing" || item.status === "uploading");

  function patch(key: string, change: Partial<Item>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  async function uploadOne(item: Item): Promise<UploadedFile | null> {
    const check = checkJobFile(item.file);
    if (!check.ok) {
      patch(item.key, { status: "failed", error: check.reason });
      return null;
    }

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      try {
        patch(item.key, { status: "preparing", progress: 0, error: undefined });
        const prepared = await prepare(item.file, check.rule);
        patch(item.key, { status: "uploading", name: prepared.name });

        const thumbnail = prepared.thumbnail
          ? await upload(jobFilePathname(prefix, prepared.thumbnail.name, "thumbnail"), prepared.thumbnail.blob, {
              access: "public",
              handleUploadUrl: `/api/jobs/${jobId}/upload`,
              contentType: "image/webp",
            })
          : null;

        const stored = await upload(jobFilePathname(prefix, prepared.name), prepared.body, {
          access: "public",
          handleUploadUrl: `/api/jobs/${jobId}/upload`,
          contentType: prepared.contentType,
          multipart: prepared.body.size > MULTIPART_ABOVE,
          onUploadProgress: ({ percentage }) => patch(item.key, { progress: percentage }),
        });

        patch(item.key, { status: "done", progress: 100 });
        return {
          url: stored.url,
          pathname: stored.pathname,
          name: prepared.name,
          width: prepared.width,
          height: prepared.height,
          thumbnail: thumbnail ? { url: thumbnail.url, pathname: thumbnail.pathname } : null,
        };
      } catch {
        if (attempt === ATTEMPTS) {
          patch(item.key, { status: "failed", error: "network" });
          return null;
        }
        // A second and then four: long enough for a dropped signal to come back.
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
      }
    }
    return null;
  }

  async function run(batch: Item[]) {
    const results: (UploadedFile | null)[] = [];
    let next = 0;
    async function worker() {
      while (next < batch.length) {
        const item = batch[next];
        next += 1;
        results.push(await uploadOne(item));
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));

    const uploaded = results.filter((r): r is UploadedFile => r !== null);
    if (uploaded.length > 0) {
      const outcome = await onRegister(uploaded);
      if (outcome.error) toast.error(outcome.error);
      else if (outcome.message) toast.success(outcome.message);
    }
    // What went up stops taking room; what failed stays, with its retry.
    setItems((current) => current.filter((item) => !batch.some((b) => b.key === item.key) || item.status === "failed"));
  }

  function start(files: FileList | File[]) {
    const batch = Array.from(files).map<Item>((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      status: "waiting",
      progress: 0,
    }));
    if (batch.length === 0) return;
    setItems((current) => [...current, ...batch]);
    void run(batch);
  }

  function retry(item: Item) {
    const fresh = { ...item, status: "waiting" as const, progress: 0, error: undefined };
    patch(item.key, fresh);
    void run([fresh]);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) start(event.dataTransfer.files);
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
            if (event.currentTarget.files) start(event.currentTarget.files);
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

        {items.length > 0 ? (
          <ul className="divide-y rounded-lg border bg-background">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  {item.status === "failed" ? (
                    <p className="text-xs text-destructive">{t(`uploadErrors.${item.error ?? "network"}`)}</p>
                  ) : (
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${item.status === "preparing" ? 4 : item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                  {item.status === "preparing" ? t("preparing") : item.status === "uploading" ? `${Math.round(item.progress)}%` : null}
                </span>
                {item.status === "failed" && item.error === "network" ? (
                  <Button type="button" variant="ghost" size="icon" onClick={() => retry(item)}>
                    <RotateCw className="size-4" />
                    <span className="sr-only">{t("retry")}</span>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

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

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "done") return <CheckCircle2 className="size-4 shrink-0 text-[var(--quote-accepted)]" />;
  if (status === "failed") return <AlertCircle className="size-4 shrink-0 text-destructive" />;
  return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />;
}

type Prepared = {
  name: string;
  body: Blob;
  contentType: string;
  width: number | null;
  height: number | null;
  thumbnail: { name: string; blob: Blob } | null;
};

/**
 * Brings a photo down to size and makes its gallery copy, draws a PDF's first
 * page for the grid; anything else passes through. The library is loaded here rather than at the top, so nobody pays
 * for it until they actually upload a photo.
 */
async function prepare(file: File, rule: FileRule): Promise<Prepared> {
  const passthrough: Prepared = { name: file.name, body: file, contentType: rule.contentType, width: null, height: null, thumbnail: null };
  if (rule.kind === "pdf") {
    const cover = await pdfThumbnail(file);
    return cover ? { ...passthrough, thumbnail: { name: renameForType(file.name, "image/webp"), blob: cover } } : passthrough;
  }
  if (rule.kind !== "image") return passthrough;

  const size = await imageSize(file);
  if (!size) return passthrough;

  const { default: imageCompression } = await import("browser-image-compression");
  let body: Blob = file;
  let contentType = rule.contentType;
  let name = file.name;
  let { width, height } = size;

  if (shouldCompress(rule, { size: file.size, width, height })) {
    contentType = compressedType(rule.contentType);
    body = await imageCompression(file, {
      maxWidthOrHeight: IMAGE_MAX_EDGE,
      initialQuality: 0.8,
      fileType: contentType,
      useWebWorker: true,
      // The edge does the work; this only stops the library looping on quality.
      maxSizeMB: 20,
    });
    name = renameForType(file.name, contentType);
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const thumbnailBlob = await imageCompression(file, {
    maxWidthOrHeight: THUMBNAIL_EDGE,
    initialQuality: 0.7,
    fileType: "image/webp",
    useWebWorker: true,
    maxSizeMB: 1,
  });
  return { name, body, contentType, width, height, thumbnail: { name: renameForType(name, "image/webp"), blob: thumbnailBlob } };
}

/** The photo's size as it will be shown — turned the way the camera meant. */
async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
