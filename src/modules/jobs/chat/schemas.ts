import { MAX_CHAT_LENGTH } from "./text";

/**
 * A message's text as it is stored: plain, trimmed, and cut at the limit
 * rather than refused — a long paste in a chat is still a message. Line
 * breaks stay; runs of blank lines fold to one.
 */
export function chatBody(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHAT_LENGTH);
}
