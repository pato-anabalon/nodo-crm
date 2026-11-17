import { mentionQuery } from "@nodo/core/jobs/chat/text";
import { dayIn } from "@nodo/core/jobs/timeline";
import type { InfiniteData } from "@tanstack/react-query";
import type { ChatMessage, ChatPage, Person } from "./types";

/**
 * The chat's pure half: what the cache becomes when a message is sent or
 * deleted before the server answers, how the list is cut into runs and days,
 * and the `@` list. Pure, so it is checked without a screen.
 */

type Pages = InfiniteData<ChatPage>;

/** A sent message at the end of the newest page, as plain text until the server cuts it up. */
export function withPending(data: Pages, body: string, author: Person | null, now: Date): Pages {
  const message: ChatMessage = {
    id: `pending-${now.getTime()}`,
    author,
    segments: body ? [{ type: "text", text: body }] : [],
    files: [],
    createdAt: now.toISOString(),
    canDelete: false,
    pending: true,
  };
  const [newest, ...older] = data.pages;
  if (!newest) return data;
  return { ...data, pages: [{ ...newest, messages: [...newest.messages, message] }, ...older] };
}

export function withoutMessage(data: Pages, id: string): Pages {
  return { ...data, pages: data.pages.map((page) => ({ ...page, messages: page.messages.filter((m) => m.id !== id) })) };
}

/** Five minutes apart, or somebody else, starts a new run with its own name and time. */
const RUN_GAP_MS = 5 * 60 * 1000;

export type ChatItem = {
  message: ChatMessage;
  /** The first of a run: draw the name and the time. */
  opensRun: boolean;
  /** The first of a day on the company's calendar: draw the day above it. */
  day: string | null;
};

/**
 * Newest first, for a list drawn upside down — which is what keeps the latest
 * message at the bottom and the thumb near the box. Each page arrives oldest
 * first, and the pages newest first.
 */
export function chatItems(data: Pages | undefined, timeZone: string): ChatItem[] {
  const messages = (data?.pages ?? []).flatMap((page) => [...page.messages].reverse());
  return messages.map((message, index) => {
    const older = messages[index + 1];
    const at = new Date(message.createdAt);
    const day = dayIn(at, timeZone);
    const olderDay = older ? dayIn(new Date(older.createdAt), timeZone) : null;
    const sameRun =
      older !== undefined &&
      olderDay === day &&
      (older.author?.id ?? null) === (message.author?.id ?? null) &&
      at.getTime() - new Date(older.createdAt).getTime() < RUN_GAP_MS;
    return { message, opensRun: !sameRun, day: olderDay === day ? null : day };
  });
}

/** The name a mention is matched on by the server: the person's name, or their whole address. */
export function mentionName(person: Pick<Person, "name" | "email">): string {
  return person.name?.trim() || person.email;
}

/** Who the `@` being typed could mean: the job's people whose name starts a word with it. */
export function mentionCandidates(textBeforeCaret: string, people: Person[], me: string | undefined, max = 5) {
  const typing = mentionQuery(textBeforeCaret);
  if (!typing) return null;
  const query = typing.query.toLowerCase();
  const matches = people.filter(
    (person) =>
      person.id !== me &&
      mentionName(person)
        .toLowerCase()
        .split(/[\s.@_-]+/)
        .some((word) => word.startsWith(query)),
  );
  return { start: typing.start, people: matches.slice(0, max) };
}

/** The text with the `@` being typed replaced by the whole name and a space, ready for the next word. */
export function insertMention(body: string, start: number, caret: number, person: Pick<Person, "name" | "email">): string {
  return `${body.slice(0, start)}@${mentionName(person)} ${body.slice(caret).replace(/^\S*/, "").replace(/^ /, "")}`;
}
