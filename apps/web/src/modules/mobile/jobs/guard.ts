import type { Permission } from "@nodo/core/auth/permissions";
import { can, ForbiddenError, type CompanyContext } from "@/lib/auth/session";
import { jobContextFor, type JobContext } from "@/modules/jobs/access";
import { notFound } from "../route";

/**
 * `requireJobContext` for the app: the same three questions through the same
 * `jobContextFor`, a job this person can't see answering 404 like one that
 * doesn't exist. `reads` are the tool's own read permissions on top of the act
 * — ticking a to-do off also takes `todos.read`, as it does on the web.
 *
 * Something inside a job is reached by reading its row first and passing the
 * `jobId` from there, never one the app sent.
 */
export async function jobIn(
  ctx: CompanyContext,
  jobId: string,
  permission: Permission,
  ...reads: Permission[]
): Promise<JobContext> {
  const found = await jobContextFor(ctx, jobId, permission);
  if (!found) throw notFound();
  for (const read of reads) {
    if (!can(found.ctx, read)) throw new ForbiddenError(read);
  }
  return found;
}

/** A row looked up by id, or the app's 404. */
export function found<T>(row: T | null | undefined): T {
  if (!row) throw notFound();
  return row;
}
