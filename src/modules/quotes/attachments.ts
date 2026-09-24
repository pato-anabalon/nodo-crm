/**
 * Files that travel with a quote: marked-up drawings, spec sheets, site photos.
 *
 * Unlike the terms and conditions — which belong to the company and are always
 * the same — these belong to each quote, so images are accepted too.
 */
export const ACCEPTED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** 20 MB: a scanned drawing weighs more than a set of terms and conditions. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/** How many are allowed per quote, so the email stays usable. */
export const MAX_ATTACHMENTS_PER_QUOTE = 10;

export type AttachmentCheck =
  | { ok: true }
  | { ok: false; reason: "type" | "size" | "empty" | "too-many" };

export function checkAttachment(
  file: { type: string; size: number; name: string },
  existingCount: number,
): AttachmentCheck {
  if (!file.name || file.size === 0) return { ok: false, reason: "empty" };
  if (existingCount >= MAX_ATTACHMENTS_PER_QUOTE) return { ok: false, reason: "too-many" };
  if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type as (typeof ACCEPTED_ATTACHMENT_TYPES)[number])) {
    return { ok: false, reason: "type" };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

/** Path inside the store, always under the company and the quote. */
export function attachmentPathname(
  companyId: string,
  quoteId: string,
  fileName: string,
): string {
  const safe = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `companies/${companyId}/quotes/${quoteId}/${safe || "attachment"}`;
}
