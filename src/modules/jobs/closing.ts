import type { Permission } from "@/lib/auth/permissions";

/**
 * A finished job is read-only. `COMPLETED` is the one status that locks: it is
 * what `requireJobContext` looks at, so every action and route that goes through
 * it is shut at once, with no list of them to keep up to date.
 */
export function isJobClosed(status: string): boolean {
  return status === "COMPLETED";
}

/** What may still be done to a finished job, though it asks for more than reading. */
const ALLOWED_WHEN_CLOSED: ReadonlySet<Permission> = new Set([
  // Opening it again is the way out of the lock.
  "jobs.reopen",
  // Finishing it twice is a no-op the action answers, not a change.
  "jobs.finish",
  // Removing the whole job is not a change *inside* it; it takes the lock with it.
  "jobs.delete",
]);

/**
 * Whether an action behind this permission changes something. Reading is the
 * `*.read` family (`jobs.read`, `todos.read`, `lineup.read`) and `jobs.read.all`;
 * everything else — create, update, delete, complete, dates, members, moderate —
 * writes. Deciding by what is *not* a read means a permission added later is
 * locked by default instead of slipping through until somebody remembers it.
 */
export function isWritePermission(permission: Permission): boolean {
  if (ALLOWED_WHEN_CLOSED.has(permission)) return false;
  return !(permission.endsWith(".read") || permission === "jobs.read.all");
}

/**
 * The same context with every writing permission taken off, for a finished job.
 * Pages and components decide what to draw from `can(ctx, …)` and `canTouch(…)`,
 * so handing them this context hides every button of a locked job without a
 * `&& !closed` at each of them — and a button added tomorrow is hidden too.
 */
export function withoutWrites<T extends { permissions: Set<Permission> }>(ctx: T): T {
  return { ...ctx, permissions: new Set([...ctx.permissions].filter((permission) => !isWritePermission(permission))) };
}

/** Thrown by `requireJobContext`: the job is finished and the action would change it. */
export class JobClosedError extends Error {
  constructor(public readonly jobId: string) {
    super(`The job ${jobId} is finished`);
    this.name = "JobClosedError";
  }
}
