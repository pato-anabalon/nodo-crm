import { lookup } from "node:dns/promises";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db/prisma";
import { LeadAttachmentStatus } from "@/generated/prisma/enums";
import {
  MAX_LEAD_ATTACHMENT_BYTES,
  attachmentContentType,
  leadAttachmentPathname,
} from "./attachments";
import { isPublicAddress } from "./network";

/** Per file. A form's upload host answers well inside this. */
const DOWNLOAD_TIMEOUT_MS = 30_000;

/**
 * Brings a lead's pending attachments into our store.
 *
 * Runs after the response (`after()`), so the customer's form never waits on
 * it. One file failing doesn't stop the rest: each row ends `STORED` or
 * `FAILED` on its own.
 */
export async function copyLeadAttachments(leadId: string): Promise<void> {
  const pending = await prisma.leadAttachment.findMany({
    where: { leadId, status: LeadAttachmentStatus.PENDING },
    orderBy: { position: "asc" },
  });

  for (const attachment of pending) {
    try {
      const contentType = attachmentContentType(attachment.name, attachment.contentType);
      if (!contentType) throw new Error("File type not allowed");

      const body = await download(attachment.sourceUrl, contentType);
      const blob = await put(
        leadAttachmentPathname(attachment.companyId, attachment.leadId, attachment.name),
        body,
        { access: "public", addRandomSuffix: true, contentType },
      );

      await prisma.leadAttachment.update({
        where: { id: attachment.id },
        data: {
          status: LeadAttachmentStatus.STORED,
          url: blob.url,
          pathname: blob.pathname,
          contentType,
          size: body.byteLength,
          error: null,
        },
      });
    } catch (error) {
      await prisma.leadAttachment.update({
        where: { id: attachment.id },
        data: {
          status: LeadAttachmentStatus.FAILED,
          error: (error instanceof Error ? error.message : String(error)).slice(0, 300),
        },
      });
    }
  }
}

async function download(sourceUrl: string, expectedType: string): Promise<Buffer> {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") throw new Error("The URL is not https");

  // Every address the name resolves to must be public, or a hostname pointing
  // at the private network would get us to fetch it.
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || !addresses.every((entry) => isPublicAddress(entry.address))) {
    throw new Error("The file host is not public");
  }

  const response = await fetch(url, {
    // A redirect could land on an address that was never checked.
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) {
    throw new Error(`The download answered ${response.status}`);
  }

  const declared = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== expectedType) {
    // Only the same family passes: heic and heif are used interchangeably.
    const family = (type: string) => (type === "image/heif" ? "image/heic" : type);
    if (family(declared) !== family(expectedType)) {
      throw new Error(`The file arrived as ${declared}`);
    }
  }

  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_LEAD_ATTACHMENT_BYTES) {
    throw new Error("The file is larger than 10 MB");
  }

  // Counted while reading: `content-length` can be missing or wrong.
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_LEAD_ATTACHMENT_BYTES) {
      await reader.cancel();
      throw new Error("The file is larger than 10 MB");
    }
    chunks.push(value);
  }
  if (received === 0) throw new Error("The file arrived empty");

  return Buffer.concat(chunks);
}
