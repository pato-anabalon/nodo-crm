/**
 * Turning an overdue task into a notice.
 *
 * Worked out when somebody opens the app rather than by a scheduled job. For a
 * bell that is exactly right — the notice exists the moment there is an eye to
 * read it — and it needs no infrastructure at all. Email for the same thing does
 * need a scheduler, and that is a separate piece of work.
 */

/** The day a due date falls on, as a key: one notice per task per day. */
export function dueDedupeKey(taskId: string, on: Date): string {
  return `task-due:${taskId}:${on.toISOString().slice(0, 10)}`;
}

/**
 * Whether a task should be nagging about right now.
 *
 * True from the moment its due date passes, and for anything still unfinished.
 * A task with no date is never overdue: it is a reminder of something to do, not
 * a promise about when.
 */
export function isDue(
  task: { dueAt: Date | null; completedAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (task.completedAt !== null || task.dueAt === null) return false;
  return task.dueAt.getTime() <= now.getTime();
}
