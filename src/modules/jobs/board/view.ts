import { formatBytes } from "@/modules/documents/constants";
import { kindOfContentType } from "../files";
import type { JobFileRow } from "../files-service";
import type { Attachment } from "./attachments";

/** A stored file as the gallery and the attachment field want it. */
export function toAttachment(file: JobFileRow, formatLocale: string): Attachment {
  return {
    id: file.id,
    name: file.name,
    url: file.url,
    kind: kindOfContentType(file.contentType),
    thumbnailUrl: file.thumbnailUrl,
    width: file.width,
    height: file.height,
    sizeLabel: formatBytes(file.size, formatLocale),
  };
}

/** A category's label in a select: its emoji, then its name. */
export function categoryLabel(category: { emoji: string }, name: string): string {
  return `${category.emoji} ${name}`;
}
