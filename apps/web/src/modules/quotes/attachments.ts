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

/** The folder every file of one quote lives in. */
export function attachmentFolder(companyId: string, quoteId: string): string {
  return `companies/${companyId}/quotes/${quoteId}/`;
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
  return `${attachmentFolder(companyId, quoteId)}${safe || "attachment"}`;
}

/**
 * Whether a path in the store is one this quote's own upload could have
 * produced — straight inside its folder, in the alphabet `attachmentPathname`
 * leaves behind (the random suffix Blob appends is drawn from it too).
 *
 * The browser uploads the file itself and then tells the server where it
 * went, so this is what stands between that claim and a row: without it,
 * a hand-crafted request could register another company's file, or another
 * quote's, as an attachment of this one.
 */
export function isAttachmentPathOf(companyId: string, quoteId: string, pathname: string): boolean {
  const folder = attachmentFolder(companyId, quoteId);
  if (!pathname.startsWith(folder)) return false;
  const name = pathname.slice(folder.length);
  return /^[a-zA-Z0-9.-]+$/.test(name) && !name.includes("..");
}
