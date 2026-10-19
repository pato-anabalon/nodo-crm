import type { Permission } from "@/lib/auth/permissions";
import type { Person } from "../avatars";
import type { Attachment } from "../board/attachments";
import { toAttachment } from "../board/view";
import { canTouch } from "../rules";
import { dayIn } from "../timeline";
import type { ChatPage } from "./service";
import { chatSegments, type ChatSegment } from "./text";

/**
 * A message as the chat screen draws it. Everything that needs the company's
 * format or the reader's permissions is worked out here, on the server: a
 * client component can't be handed a formatter, and the page and the poll
 * must draw a message identically.
 */
export type ChatMessageView = {
  id: string;
  author: Person | null;
  segments: ChatSegment[];
  files: Attachment[];
  /** ISO instant, for grouping a run of messages from one person. */
  createdAt: string;
  /** `YYYY-MM-DD` in the company's timezone, and its heading. */
  day: string;
  dayLabel: string;
  time: string;
  canDelete: boolean;
};

export type ChatFeed = { messages: ChatMessageView[]; hasEarlier: boolean };

export function chatFeed(
  page: ChatPage,
  options: {
    formatLocale: string;
    timezone: string;
    viewer: { userId: string; permissions: ReadonlySet<Permission> };
  },
): ChatFeed {
  const { formatLocale, timezone, viewer } = options;
  const time = new Intl.DateTimeFormat(formatLocale, { timeStyle: "short", timeZone: timezone });
  const heading = new Intl.DateTimeFormat(formatLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const people = new Map(page.mentioned.map((person) => [person.id, person]));

  return {
    hasEarlier: page.hasEarlier,
    messages: page.messages.map((row) => {
      const day = dayIn(row.createdAt, timezone);
      return {
        id: row.id,
        author: row.author,
        segments: chatSegments(row.body, row.mentionIds.flatMap((id) => people.get(id) ?? [])),
        files: row.files.map((file) => toAttachment(file, formatLocale)),
        createdAt: row.createdAt.toISOString(),
        day,
        dayLabel: heading.format(new Date(`${day}T12:00:00Z`)),
        time: time.format(row.createdAt),
        canDelete: canTouch(viewer.userId, viewer.permissions, "chat.delete", row.authorId),
      };
    }),
  };
}
