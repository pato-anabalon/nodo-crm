import { decodeEntities } from "./html";
import type { TodoDetail, TodoList, TodoRow } from "./types";

/**
 * The lists after a tick, before the server answers — pure, so the shape the
 * screen moves to is checked without one. As on the web: done to-dos sit below,
 * most recently finished first; one reopened goes back to its own position.
 */
export function tickInLists(lists: TodoList[], todoId: string, done: boolean, now: Date = new Date()): TodoList[] {
  return lists.map((list) => {
    const row = [...list.open, ...list.done].find((todo) => todo.id === todoId);
    if (!row || row.done === done) return list;

    const moved: TodoRow = { ...row, done, completedAt: done ? now.toISOString() : null, overdue: done ? false : row.overdue };
    const open = list.open.filter((todo) => todo.id !== todoId);
    const finished = list.done.filter((todo) => todo.id !== todoId);
    return done
      ? { ...list, open, done: [moved, ...finished] }
      : { ...list, open: [...open, moved].sort((a, b) => a.position - b.position), done: finished };
  });
}

export function tickTodo(todo: TodoDetail, done: boolean, now: Date = new Date()): TodoDetail {
  return { ...todo, done, completedAt: done ? now.toISOString() : null, overdue: done ? false : todo.overdue };
}

/**
 * Notes come back as sanitised HTML and the app writes plain text. Turned back
 * into text for the edit box: paragraphs and line breaks survive, the rest is
 * dropped — which is why `isFormatted` warns before a save flattens them.
 */
export function htmlToPlainText(html: string | null): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|li|blockquote|pre|tr)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Anything beyond paragraphs and line breaks, which a plain-text edit would lose. */
export function isFormatted(html: string | null): boolean {
  if (!html) return false;
  return /<(?!\/?(p|br)\b)[a-z]/i.test(html);
}
