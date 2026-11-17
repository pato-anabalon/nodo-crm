/**
 * Files that arrive with a website form.
 *
 * A form can't push files through this API (a body is capped at a few KB), so
 * it uploads them wherever it already does and sends us the links. Here they're
 * read out of the payload and checked; `attachment-copy.ts` then brings each one
 * into our own store, so the lead doesn't depend on someone else's storage.
 *
 * Pure, with no Prisma or network, so the limits can be tested at the edges.
 */

/** Payload keys a list of files is read from. Order is priority. */
const ATTACHMENT_KEYS = ["attachments", "files", "uploads"] as const;

export const LEAD_ATTACHMENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

const ACCEPTED_CONTENT_TYPES = new Set(Object.values(LEAD_ATTACHMENT_TYPES));

export const MAX_LEAD_ATTACHMENTS = 5;
export const MAX_LEAD_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_LEAD_ATTACHMENTS_TOTAL_BYTES = 25 * 1024 * 1024;

export type IncomingAttachment = {
  name: string;
  sourceUrl: string;
  contentType: string | null;
  size: number | null;
};

export type ExtractedAttachments = {
  accepted: IncomingAttachment[];
  /** Why each discarded entry was left out; recorded, never sent back. */
  rejected: string[];
};

/** The keys holding files, so the submission panel doesn't show them twice. */
export function isAttachmentKey(key: string): boolean {
  return (ATTACHMENT_KEYS as readonly string[]).includes(key.toLowerCase());
}

/**
 * Reads the files out of the payload.
 *
 * Accepts `[{ name, url, size, type }]` (or `contentType`) and plain URL
 * strings. A bad entry is dropped rather than failing the lead: losing an
 * enquiry over a broken attachment would be the worse outcome.
 */
export function extractAttachments(payload: Record<string, unknown>): ExtractedAttachments {
  const list = findList(payload);
  const accepted: IncomingAttachment[] = [];
  const rejected: string[] = [];
  let total = 0;

  for (const item of list) {
    const parsed = readEntry(item);
    if (!parsed) {
      rejected.push("File entry without a readable URL");
      continue;
    }

    if (accepted.length >= MAX_LEAD_ATTACHMENTS) {
      rejected.push(`${parsed.name}: over the limit of ${MAX_LEAD_ATTACHMENTS} files`);
      continue;
    }
    if (!isHttpsUrl(parsed.sourceUrl)) {
      rejected.push(`${parsed.name}: the URL is not https`);
      continue;
    }
    if (!attachmentContentType(parsed.name, parsed.contentType)) {
      rejected.push(`${parsed.name}: file type not allowed`);
      continue;
    }
    if (parsed.size !== null) {
      if (parsed.size > MAX_LEAD_ATTACHMENT_BYTES) {
        rejected.push(`${parsed.name}: larger than 10 MB`);
        continue;
      }
      if (total + parsed.size > MAX_LEAD_ATTACHMENTS_TOTAL_BYTES) {
        rejected.push(`${parsed.name}: total goes over 25 MB`);
        continue;
      }
      total += parsed.size;
    }

    accepted.push(parsed);
  }

  return { accepted, rejected };
}

/**
 * The content type a file will be stored with, or null when it isn't allowed.
 *
 * The extension decides; a declared type only has to agree with it. A browser
 * often sends an empty type for HEIC, so an empty one isn't held against it.
 */
export function attachmentContentType(name: string, declared: string | null): string | null {
  const byExtension = LEAD_ATTACHMENT_TYPES[extensionOf(name)];
  if (!byExtension) return null;
  if (!declared || declared === "application/octet-stream") return byExtension;

  const clean = declared.split(";")[0]!.trim().toLowerCase();
  if (!ACCEPTED_CONTENT_TYPES.has(clean)) return null;
  // `.heic` declared as `image/heif` is the same family; anything else must match.
  const family = (type: string) => (type === "image/heif" ? "image/heic" : type);
  return family(clean) === family(byExtension) ? clean : null;
}

/** Path inside the store, always under the company and the lead. */
export function leadAttachmentPathname(companyId: string, leadId: string, fileName: string): string {
  return `companies/${companyId}/leads/${leadId}/${safeFileName(fileName)}`;
}

export function safeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const safe = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return safe || "attachment";
}

function findList(payload: Record<string, unknown>): unknown[] {
  for (const [key, value] of Object.entries(payload)) {
    if (isAttachmentKey(key) && Array.isArray(value)) return value;
  }
  return [];
}

function readEntry(item: unknown): IncomingAttachment | null {
  if (typeof item === "string") {
    const url = item.trim();
    return url ? { name: nameFromUrl(url), sourceUrl: url, contentType: null, size: null } : null;
  }
  if (!item || typeof item !== "object") return null;

  const record = item as Record<string, unknown>;
  const url = text(record.url) ?? text(record.href) ?? text(record.src);
  if (!url) return null;

  const size = typeof record.size === "number" && Number.isFinite(record.size) && record.size >= 0
    ? Math.round(record.size)
    : null;

  return {
    name: (text(record.name) ?? text(record.filename) ?? nameFromUrl(url)).slice(0, 200),
    sourceUrl: url,
    contentType: text(record.type) ?? text(record.contentType) ?? text(record.mimeType),
    size,
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function nameFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").pop();
    return last ? decodeURIComponent(last) : "attachment";
  } catch {
    return "attachment";
  }
}

function extensionOf(name: string): string {
  return name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
