import { MessageAuthor } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";

export type ThreadMessage = {
  id: string;
  author: MessageAuthor;
  body: string;
  /**
   * Already formatted on the server: the time zone and the format belong to the
   * company, not to the browser of whoever is looking.
   */
  sentAtLabel: string;
  authorName: string | null;
};

type StoredMessage = {
  id: string;
  author: MessageAuthor;
  body: string;
  createdAt: Date;
  authorUser?: { name: string | null; email: string } | null;
  /** Which recipient wrote it, for a message from the customer side. */
  authorName?: string | null;
};

/**
 * The thread, ready to render.
 *
 * Shared by the two sides so a message reads the same in the panel as in the
 * portal, and by the first render and the polling endpoint so a message doesn't
 * change shape the moment it arrives without a reload.
 *
 * `withAuthorNames` is off for the customer on purpose: which of the company's
 * staff replied is internal, and the portal already attributes it to the company.
 * A customer's own name is not internal — with several people on one quote it
 * is the only way to tell their messages apart — so it travels either way.
 */
export function formatThread(
  messages: StoredMessage[],
  options: { formatLocale: string; timezone: string; withAuthorNames: boolean },
): ThreadMessage[] {
  return messages.map((message) => ({
    id: message.id,
    author: message.author,
    body: message.body,
    sentAtLabel: formatDateTime(message.createdAt, options.formatLocale, options.timezone),
    authorName:
      message.author === MessageAuthor.CLIENT
        ? (message.authorName ?? null)
        : options.withAuthorNames
          ? (message.authorUser?.name ?? message.authorUser?.email ?? null)
          : null,
  }));
}

/** Has anything actually changed? Avoids repainting the thread every poll. */
export function threadChanged(current: ThreadMessage[], next: ThreadMessage[]): boolean {
  if (current.length !== next.length) return true;
  return current.at(-1)?.id !== next.at(-1)?.id;
}
