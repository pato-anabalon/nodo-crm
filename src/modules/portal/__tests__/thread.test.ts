import { MessageAuthor } from "@/generated/prisma/enums";
import { formatThread, threadChanged, type ThreadMessage } from "../thread";

const stored = (over: Partial<Parameters<typeof formatThread>[0][number]> = {}) => ({
  id: "m1",
  author: MessageAuthor.STAFF,
  body: "Morning",
  createdAt: new Date("2026-03-04T21:30:00Z"),
  authorUser: { name: "Ana Reyes", email: "ana@acme.test" },
  ...over,
});

const opts = { formatLocale: "en-NZ", timezone: "Pacific/Auckland", withAuthorNames: true };

describe("formatThread", () => {
  it("stamps the time in the company's zone, not the reader's", () => {
    // 21:30 UTC on 4 March is the morning of the 5th in Auckland.
    const [message] = formatThread([stored()], opts);
    expect(message.sentAtLabel).toMatch(/5/);
  });

  it("names the person who replied for the company's own panel", () => {
    expect(formatThread([stored()], opts)[0].authorName).toBe("Ana Reyes");
  });

  it("falls back to the email when the person has no name", () => {
    const [message] = formatThread([stored({ authorUser: { name: null, email: "a@b.test" } })], opts);
    expect(message.authorName).toBe("a@b.test");
  });

  it("never tells the customer which member of staff replied", () => {
    // Who answered internally is not the customer's business; the portal
    // attributes it to the company instead.
    const [message] = formatThread([stored()], { ...opts, withAuthorNames: false });
    expect(message.authorName).toBeNull();
  });

  it("keeps the body and the side untouched", () => {
    const [message] = formatThread([stored({ author: MessageAuthor.CLIENT, body: "  spaced  " })], opts);
    expect(message.author).toBe(MessageAuthor.CLIENT);
    expect(message.body).toBe("  spaced  ");
  });
});

describe("threadChanged", () => {
  const msg = (id: string): ThreadMessage => ({
    id,
    author: MessageAuthor.STAFF,
    body: "x",
    sentAtLabel: "",
    authorName: null,
  });

  it("sees a new message arriving", () => {
    expect(threadChanged([msg("a")], [msg("a"), msg("b")])).toBe(true);
  });

  it("sees a message being removed", () => {
    expect(threadChanged([msg("a"), msg("b")], [msg("a")])).toBe(true);
  });

  it("reports no change when the thread is the same", () => {
    expect(threadChanged([msg("a"), msg("b")], [msg("a"), msg("b")])).toBe(false);
  });

  it("notices a replacement that keeps the length", () => {
    expect(threadChanged([msg("a")], [msg("z")])).toBe(true);
  });

  it("handles both being empty", () => {
    expect(threadChanged([], [])).toBe(false);
  });
});
