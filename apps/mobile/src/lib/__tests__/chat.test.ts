import { chatItems, insertMention, mentionCandidates, withoutMessage, withPending } from "../chat";
import type { ChatMessage, ChatPage, Person } from "../types";

const ana: Person = { id: "u1", name: "Ana María", email: "ana@example.com", image: null };
const bruno: Person = { id: "u2", name: null, email: "bruno@example.com", image: null };
const carla: Person = { id: "u3", name: "Carla Ruiz", email: "carla@example.com", image: null };

const message = (id: string, author: Person | null, createdAt: string): ChatMessage => ({
  id,
  author,
  segments: [{ type: "text", text: id }],
  files: [],
  createdAt,
  canDelete: true,
});

const pages = (...list: ChatPage[]) => ({ pages: list, pageParams: list.map((_, i) => (i ? `p${i}` : null)) });

describe("withPending and withoutMessage", () => {
  it("adds the sent message at the end of the newest page, faded until confirmed", () => {
    const data = pages({ hasEarlier: true, messages: [message("a", ana, "2026-11-08T01:00:00Z")] }, { hasEarlier: false, messages: [] });
    const next = withPending(data, "hello", ana, new Date("2026-11-08T02:00:00Z"));
    expect(next.pages[0].messages.map((m) => m.id)).toEqual(["a", `pending-${Date.parse("2026-11-08T02:00:00Z")}`]);
    expect(next.pages[0].messages[1]).toMatchObject({ pending: true, canDelete: false, segments: [{ type: "text", text: "hello" }] });
    expect(next.pages[1]).toBe(data.pages[1]);
  });

  it("takes a message off whichever page it is on", () => {
    const data = pages({ hasEarlier: true, messages: [message("b", ana, "2026-11-08T01:00:00Z")] }, { hasEarlier: false, messages: [message("a", bruno, "2026-11-07T01:00:00Z")] });
    expect(withoutMessage(data, "a").pages.map((page) => page.messages.length)).toEqual([1, 0]);
  });
});

describe("chatItems", () => {
  const data = pages(
    {
      hasEarlier: true,
      messages: [
        message("c", ana, "2026-11-08T00:10:00Z"),
        message("d", ana, "2026-11-08T00:12:00Z"),
        message("e", ana, "2026-11-08T00:30:00Z"),
        message("f", bruno, "2026-11-08T00:31:00Z"),
      ],
    },
    { hasEarlier: false, messages: [message("a", bruno, "2026-11-07T00:00:00Z"), message("b", ana, "2026-11-07T23:00:00Z")] },
  );

  it("lists newest first across the pages, for a list drawn upside down", () => {
    expect(chatItems(data, "Pacific/Auckland").map((item) => item.message.id)).toEqual(["f", "e", "d", "c", "b", "a"]);
  });

  it("opens a run on a new author, a five-minute gap or a new day", () => {
    const runs = Object.fromEntries(chatItems(data, "UTC").map((item) => [item.message.id, item.opensRun]));
    expect(runs).toEqual({ f: true, e: true, d: false, c: true, b: true, a: true });
  });

  it("marks the first message of each day on the company's calendar", () => {
    // In Auckland 2026-11-07T23:00Z is already the 8th, so b shares a day with c.
    const days = Object.fromEntries(chatItems(data, "Pacific/Auckland").map((item) => [item.message.id, item.day]));
    expect(days).toEqual({ f: null, e: null, d: null, c: null, b: "2026-11-08", a: "2026-11-07" });
  });
});

describe("mentions", () => {
  const people = [ana, bruno, carla];

  it("offers the people whose name starts a word with what follows the @, never me", () => {
    expect(mentionCandidates("hi @ma", people, "u3")?.people).toEqual([ana]);
    expect(mentionCandidates("hi @", people, "u1")?.people).toEqual([bruno, carla]);
    expect(mentionCandidates("hi @bru", people, "u1")).toEqual({ start: 3, people: [bruno] });
  });

  it("offers nothing outside an @ or after an email address", () => {
    expect(mentionCandidates("hello", people, "u1")).toBeNull();
    expect(mentionCandidates("ana@ex", people, "u1")).toBeNull();
  });

  it("writes the whole name, the way the server matches it, and swallows the rest of the word", () => {
    expect(insertMention("hi @an", 3, 6, ana)).toBe("hi @Ana María ");
    expect(insertMention("hi @anx later", 3, 6, ana)).toBe("hi @Ana María later");
    expect(insertMention("@br", 0, 3, bruno)).toBe("@bruno@example.com ");
  });
});
