import { checkJobFile, THUMBNAIL_MAX_BYTES, type FileRule } from "@nodo/core/jobs/files";

export type UploadRefusal = "file_heic" | "file_type" | "file_too_large";

/**
 * Why the app may not upload this file, or null when it may. The same table
 * the web checks in the browser, but held to the **stored** ceiling: the app
 * compresses a photo before asking, so the size it sends is what goes up. A
 * thumbnail is always an image and never heavier than one of ours would be.
 */
export function uploadRefusal(file: { name: string; size: number; thumbnail: boolean }): UploadRefusal | null {
  const check = checkJobFile(file);
  if (!check.ok) return check.reason === "heic" ? "file_heic" : check.reason === "size" ? "file_too_large" : "file_type";
  if (file.thumbnail && check.rule.kind !== "image") return "file_type";
  return file.size > ceiling(check.rule, file.thumbnail) ? "file_too_large" : null;
}

function ceiling(rule: FileRule, thumbnail: boolean): number {
  return thumbnail ? THUMBNAIL_MAX_BYTES : rule.maxBytes;
}
