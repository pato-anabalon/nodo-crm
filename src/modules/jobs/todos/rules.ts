/**
 * The to-dos' small decisions, kept pure so they can be checked without a
 * database: what counts as late, what a reorder may contain, who has just
 * been handed something.
 */

/**
 * Late is a due day before today — today itself is not late yet. Days are
 * `YYYY-MM-DD`, and "today" is the company's, not the server's: a to-do due
 * on Friday in Auckland is not late while it is still Friday there.
 */
export function isOverdue(dueOn: string | null, completed: boolean, today: string): boolean {
  return !completed && dueOn !== null && dueOn < today;
}

/**
 * A reorder is accepted only as a rearrangement of exactly what is there:
 * the same ids, each once. Anything else — an id from another list, one
 * missing, one twice — is a stale screen or a forged post, and is refused
 * rather than half applied.
 */
export function isPermutationOf(current: string[], proposed: string[]): boolean {
  if (current.length !== proposed.length) return false;
  const wanted = new Set(current);
  const seen = new Set<string>();
  for (const id of proposed) {
    if (!wanted.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** The people on the list now who weren't before — the ones to tell. */
export function newlyAssigned(before: string[], after: string[]): string[] {
  const had = new Set(before);
  return after.filter((id) => !had.has(id));
}

/** "3 of 8" for a list: what is done, out of everything on it. */
export function progressOf(todos: { completedAt: Date | null }[]): { done: number; total: number } {
  return { done: todos.filter((todo) => todo.completedAt !== null).length, total: todos.length };
}
