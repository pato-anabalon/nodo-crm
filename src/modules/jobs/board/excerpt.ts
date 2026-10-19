import { richTextToPlain } from "@/lib/rich-text";

/** A line of a post for the list: its first words, as plain text. */
export function excerptOf(html: string, length = 180): string {
  // A table's cells sit side by side with no space between them in the markup.
  const text = richTextToPlain(html.replace(/<\/(td|th)>/gi, " $&"))
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}
