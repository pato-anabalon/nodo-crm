import { notFound } from "next/navigation";
import type { Permission } from "@/lib/auth/permissions";
import { requireCompanyContext, ForbiddenError, can, type CompanyContext } from "@/lib/auth/session";
import { isJobClosed, isWritePermission, JobClosedError, withoutWrites } from "./closing";
import { jobVisibilityWhere } from "./scope";

export type JobContext = {
  ctx: CompanyContext;
  job: { id: string; name: string; closed: boolean };
};

/**
 * The guard every job page and action goes through.
 *
 * Three questions, all on the server: does the job exist in this company, may
 * this person be on it (a member, or `jobs.read.all`), and does their profile
 * hold the permission for what they are about to do. `ctx.db` only guards the
 * line between companies; the line between jobs is drawn here.
 *
 * A job somebody can't see answers 404, the same as one that doesn't exist.
 * Callers acting on something *inside* a job (a post, a to-do) pass the
 * `jobId` read from that row in the database, never the one the form sent.
 *
 * A finished job answers a fourth: it is read-only, so anything that would
 * change it throws `JobClosedError` — here, once, rather than in every action
 * (see `closing.ts`).
 */
export async function requireJobContext(jobId: string, permission: Permission = "jobs.read"): Promise<JobContext> {
  const ctx = await requireCompanyContext();
  if (!can(ctx, "jobs.read")) throw new ForbiddenError("jobs.read");
  if (!can(ctx, permission)) throw new ForbiddenError(permission);

  const job = await visibleJob(ctx, jobId);
  if (!job) notFound();
  if (job.closed && isWritePermission(permission)) throw new JobClosedError(job.id);
  // A finished job is read with a read-only context, so nothing on its pages offers what would be refused.
  return { ctx: job.closed ? withoutWrites(ctx) : ctx, job };
}

/**
 * The same three questions, answered rather than thrown — for route handlers,
 * which reply with a status instead of rendering a 404 page. A finished job
 * refuses a write the same way a job somebody can't see does.
 */
export async function jobAccess(
  ctx: CompanyContext,
  jobId: string,
  permission: Permission,
): Promise<JobContext["job"] | null> {
  if (!can(ctx, "jobs.read") || !can(ctx, permission)) return null;
  const job = await visibleJob(ctx, jobId);
  if (job?.closed && isWritePermission(permission)) return null;
  return job;
}

async function visibleJob(ctx: CompanyContext, jobId: string): Promise<JobContext["job"] | null> {
  const job = await ctx.db.job.findFirst({
    where: { id: jobId, ...jobVisibilityWhere(ctx.user.id, ctx.permissions) },
    select: { id: true, name: true, status: true },
  });
  return job ? { id: job.id, name: job.name, closed: isJobClosed(job.status) } : null;
}
