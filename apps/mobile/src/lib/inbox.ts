import type { Inbox } from "./types";

/** The bell after a press, before the server answers: what was unread becomes read, and the count follows. */
export function markRead(inbox: Inbox, id: string | "all"): Inbox {
  const items = inbox.items.map((item) => (id === "all" || item.id === id ? { ...item, read: true } : item));
  const newlyRead = inbox.items.filter((item, index) => !item.read && items[index].read).length;
  return { unread: Math.max(0, inbox.unread - newlyRead), items };
}
