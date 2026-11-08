"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { upload } from "@vercel/blob/client";
import { AlertCircle, CheckCircle2, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  checkJobFile,
  compressedType,
  IMAGE_MAX_EDGE,
  jobFilePathname,
  renameForType,
  shouldCompress,
  THUMBNAIL_EDGE,
  type FileRule,
} from "../files";
import type { UploadedFile } from "../files-service";
import { pdfThumbnail } from "./pdf-thumbnail";

/** Three at a time: enough to use the line, few enough that one bar on a bad signal still moves. */
const CONCURRENCY = 3;
/** Above this, Blob splits the file into parts uploaded and retried separately. */
const MULTIPART_ABOVE = 50 * 1024 * 1024;
const ATTEMPTS = 3;

type ItemStatus = "waiting" | "preparing" | "uploading" | "done" | "failed";

export type UploadItem = {
  key: string;
  file: File;
  name: string;
  status: ItemStatus;
  progress: number;
  /** A message key under `jobs.files.uploadErrors`. */
  error?: string;
};

/**
 * Photos, plans and videos from site, straight from the browser to the store —
 * the one pipeline Docs, posts and comments all upload through.
 *
 * A phone photo is re-encoded here before it leaves (`browser-image-compression`,
 * in a worker): 6 MB becomes well under one, on a site connection that is the
 * difference between uploading and giving up. A small copy goes up beside it
 * for the galleries, and a PDF's first page is drawn for the same purpose.
 * Videos and documents go as they are.
 *
 * Each file has its own bar and its own retries, so one failing on a bad signal
 * doesn't cost the rest. What went up is handed to `onUploaded` once per batch;
 * where it gets registered — a folder, a post, a comment — is the caller's.
 */
export function useUploadQueue({
  jobId,
  prefix,
  onUploaded,
}: {
  jobId: string;
  /** `companies/<id>/jobs/<id>/`: the route refuses anything outside it. */
  prefix: string;
  onUploaded: (uploads: UploadedFile[]) => Promise<void> | void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const busy = items.some((item) => item.status === "waiting" || item.status === "preparing" || item.status === "uploading");

  function patch(key: string, change: Partial<UploadItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  async function uploadOne(item: UploadItem): Promise<UploadedFile | null> {
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

  async function run(batch: UploadItem[]) {
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
    if (uploaded.length > 0) await onUploaded(uploaded);
    // What went up stops taking room; what failed stays, with its retry.
    setItems((current) => current.filter((item) => !batch.some((b) => b.key === item.key) || item.status === "failed"));
  }

  function start(files: FileList | File[]) {
    const batch = Array.from(files).map<UploadItem>((file) => ({
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

  function retry(item: UploadItem) {
    const fresh = { ...item, status: "waiting" as const, progress: 0, error: undefined };
    patch(item.key, fresh);
    void run([fresh]);
  }

  return { items, busy, start, retry };
}

/** Each file on its way up: a bar while it goes, the reason and a retry if it didn't. */
export function UploadProgress({ items, onRetry }: { items: UploadItem[]; onRetry: (item: UploadItem) => void }) {
  const t = useTranslations("jobs.files");
  if (items.length === 0) return null;
  return (
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
            <Button type="button" variant="ghost" size="icon" onClick={() => onRetry(item)}>
              <RotateCw className="size-4" />
              <span className="sr-only">{t("retry")}</span>
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
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
