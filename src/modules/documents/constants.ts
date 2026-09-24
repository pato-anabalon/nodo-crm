/** PDF only: it's what gets attached to a quote and what every customer can open. */
export const ACCEPTED_DOCUMENT_TYPES = ["application/pdf"] as const;

/** 10 MB. Terms and conditions never weigh more than that. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type DocumentCheck = { ok: true } | { ok: false; reason: "type" | "size" | "empty" };

/** Validates the file before uploading. Pure, so it can be tested without a network. */
export function checkDocument(file: { type: string; size: number; name: string }): DocumentCheck {
  if (!file.name || file.size === 0) return { ok: false, reason: "empty" };
  if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type as (typeof ACCEPTED_DOCUMENT_TYPES)[number])) {
    return { ok: false, reason: "type" };
  }
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

/** `1.2 MB` — the size shown in the document list. */
export function formatBytes(bytes: number, formatLocale: string): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

/**
 * The file's path inside the store.
 *
 * It sits under the company id so one company's documents never cross with
 * another's, not even in storage.
 */
export function documentPathname(companyId: string, fileName: string): string {
  const safe = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    // Consecutive dots are never legitimate in a filename and are the usual way
    // of trying to climb out of the directory.
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `companies/${companyId}/terms/${safe || "document.pdf"}`;
}
