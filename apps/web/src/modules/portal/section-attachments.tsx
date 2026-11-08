import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SectionAttachmentRow = {
  id: string;
  name: string;
  url: string;
  contentType: string;
};

/**
 * A section's own files, on the customer's document.
 *
 * An image gets a small preview — the customer can see at a glance what it
 * is, rather than having to open it first — anything else (a PDF, a drawing)
 * keeps the plain file badge the quote's own attachments already use below.
 * One component for both: a server component (the static section list) and a
 * client one (the interactive section selector) share it as-is, since it
 * holds no state of its own.
 */
export function SectionAttachments({
  attachments,
}: {
  attachments: SectionAttachmentRow[];
}) {
  if (attachments.length === 0) return null;

  // Two different kinds of thing, shown as two different rows rather than
  // interleaved — a row of photo previews reads at a glance, which stops
  // working the moment a document badge breaks up the row partway through.
  const images = attachments.filter((a) => a.contentType.startsWith("image/"));
  const documents = attachments.filter((a) => !a.contentType.startsWith("image/"));

  return (
    <div className="space-y-2">
      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {images.map((attachment) => (
            <li key={attachment.id}>
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-md border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="size-24 object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {documents.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {documents.map((attachment) => (
            <li key={attachment.id}>
              <Button asChild variant="outline" size="sm">
                <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                  <FileText className="size-4" />
                  {attachment.name}
                </a>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
