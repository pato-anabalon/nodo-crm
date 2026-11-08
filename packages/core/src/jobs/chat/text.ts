/**
 * A chat message is plain text. What makes it more than that — a mention, a
 * link — is found in the text here, the same way on the server that stores it
 * and the screen that draws it. Pure, so the edge cases (a name that starts
 * another, an email address, a full stop after a link) can be checked without
 * a database.
 */

export type Mentionable = { id: string; name: string };

export type ChatSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "mention"; text: string; userId: string };

/** Longest a message may be. A chat line, not a report: that is the Message Board. */
export const MAX_CHAT_LENGTH = 4000;

/** A letter or a digit in any script: what may not follow a name for it to end there. */
const WORD = /[\p{L}\p{N}]/u;

type Span = { start: number; end: number; userId: string };

/**
 * Every `@Name` in the text that names one of these people, in order and
 * never overlapping.
 *
 * At each `@` the longest name that fits wins, so "@Ana María" is Ana María
 * and not Ana followed by " María". The name has to end at a word boundary —
 * "@Anabel" isn't Ana — and the `@` must not follow a letter, which is what
 * keeps `ana@example.com` from mentioning anybody. Case doesn't matter:
 * somebody typing fast on a phone writes "@ana".
 */
function mentionSpans(body: string, people: Mentionable[]): Span[] {
  const candidates = people
    .map((person) => ({ id: person.id, name: person.name.trim() }))
    .filter((person) => person.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  const lower = body.toLowerCase();
  const spans: Span[] = [];

  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "@" || (i > 0 && WORD.test(body[i - 1]))) continue;
    const match = candidates.find((person) => {
      const end = i + 1 + person.name.length;
      return lower.startsWith(person.name.toLowerCase(), i + 1) && !(end < body.length && WORD.test(body[end]));
    });
    if (!match) continue;
    const end = i + 1 + match.name.length;
    spans.push({ start: i, end, userId: match.id });
    i = end - 1;
  }
  return spans;
}

/** The people a message names, once each. */
export function mentionedIn(body: string, people: Mentionable[]): string[] {
  return [...new Set(mentionSpans(body, people).map((span) => span.userId))];
}

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;
/** Punctuation that ends a sentence rather than the address: "see https://x.nz." */
const TRAILING = /[.,;:!?)\]'"’”]+$/;

function withLinks(text: string): ChatSegment[] {
  const out: ChatSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const href = match[0].replace(TRAILING, "");
    const start = match.index;
    if (start > last) out.push({ type: "text", text: text.slice(last, start) });
    out.push({ type: "link", text: href, href });
    last = start + href.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/**
 * The text cut into what is drawn plainly, what is a link and what is a
 * mention. Only the people the message was stored as mentioning are looked
 * for, so a name typed with no `@` is just a name.
 */
export function chatSegments(body: string, mentioned: Mentionable[]): ChatSegment[] {
  const out: ChatSegment[] = [];
  let last = 0;
  for (const span of mentionSpans(body, mentioned)) {
    if (span.start > last) out.push(...withLinks(body.slice(last, span.start)));
    out.push({ type: "mention", text: body.slice(span.start, span.end), userId: span.userId });
    last = span.end;
  }
  if (last < body.length) out.push(...withLinks(body.slice(last)));
  return out;
}

/** One line of the message, short enough for a notice or a card. */
export function chatExcerpt(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * The `@` being typed right before the caret, if any: what the list of people
 * filters on. Null once a space ends it — a name with a space in it is picked
 * from the list, not typed out.
 */
export function mentionQuery(textBeforeCaret: string): { query: string; start: number } | null {
  const match = /(^|\s)@([^\s@]{0,40})$/u.exec(textBeforeCaret);
  if (!match) return null;
  return { query: match[2], start: textBeforeCaret.length - match[2].length - 1 };
}
