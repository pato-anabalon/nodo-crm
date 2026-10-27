import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  checkAttachment,
  type AttachmentCheck,
} from "@/modules/quotes/attachments";
import { leadAttachmentPathname } from "@/modules/ingest/attachments";

/**
 * Files the team attaches to a lead by hand: the photos and plans a customer
 * sent by phone or email, for a lead that didn't arrive through a web form.
 *
 * Same types and size cap as a quote's attachments, and the same direct upload
 * to the store — a phone photo is past the 4.5 MB a Vercel function accepts.
 */
export { ACCEPTED_ATTACHMENT_TYPES as ACCEPTED_LEAD_FILE_TYPES, MAX_ATTACHMENT_BYTES as MAX_LEAD_FILE_BYTES };

export const MAX_LEAD_FILES = 30;

export type LeadFileCheck = AttachmentCheck;

/** `checkAttachment` with this feature's own cap on how many a lead may hold. */
export function checkLeadFile(
  file: { type: string; size: number; name: string },
  existingCount: number,
): LeadFileCheck {
  // The shared check is called with 0 so its per-quote cap (10) doesn't apply.
  const shared = checkAttachment(file, 0);
  if (!shared.ok) return shared;
  if (existingCount >= MAX_LEAD_FILES) return { ok: false, reason: "too-many" };
  return shared;
}

/** The folder every file of one lead lives in — the one the web-form copy uses too. */
export function leadFileFolder(companyId: string, leadId: string): string {
  return `companies/${companyId}/leads/${leadId}/`;
}

export { leadAttachmentPathname as leadFilePathname };

/**
 * Whether a path in the store is one this lead's own upload could have produced.
 * The browser uploads, then tells the server where the file went; without this a
 * hand-crafted request could register another lead's or company's file as this
 * lead's.
 */
export function isLeadFilePathOf(companyId: string, leadId: string, pathname: string): boolean {
  const folder = leadFileFolder(companyId, leadId);
  if (!pathname.startsWith(folder)) return false;
  const name = pathname.slice(folder.length);
  return /^[a-zA-Z0-9.-]+$/.test(name) && !name.includes("..");
}
