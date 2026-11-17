import type { TaskFilters } from "./schemas";

/**
 * What "mine" and "all" actually select.
 *
 * Pure so the rule can be checked without a database, because getting it wrong
 * is invisible: the task saves, the snackbar says so, and the list it should
 * have joined simply doesn't contain it.
 */
export function taskWhere(filters: TaskFilters, userId: string) {
  const completedAt = filters.show === "done" ? { not: null } : null;
  if (filters.scope === "all") return { completedAt };

  return {
    completedAt,
    /*
     * Mine is not only what was assigned to me.
     *
     * A task written down and left unassigned used to belong to nobody, so it
     * vanished from the only list its author was looking at — added, confirmed,
     * gone. Something I wrote and nobody else has picked up is mine until
     * somebody takes it.
     */
    OR: [{ assigneeId: userId }, { assigneeId: null, createdById: userId }],
  };
}
