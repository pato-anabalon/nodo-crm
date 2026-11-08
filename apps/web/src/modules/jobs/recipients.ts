import type { CompanyContext } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { MembershipStatus } from "@/generated/prisma/client";

/**
 * The people among these whose profile here reads the tool, and who are
 * still active in the company. A notice is a link; a link to a page that
 * answers 404 is noise.
 */
export async function readersAmong(ctx: CompanyContext, userIds: string[], permission: Permission): Promise<string[]> {
  if (userIds.length === 0) return [];
  const memberships = await ctx.db.membership.findMany({
    where: {
      userId: { in: [...new Set(userIds)] },
      status: MembershipStatus.ACTIVE,
      role: {
        permissions: {
          some: { permission: { key: { in: [permission, "jobs.read"] } } },
        },
      },
    },
    select: { userId: true, role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
  });
  return memberships
    .filter((m) => {
      const keys = new Set(m.role.permissions.map((p) => p.permission.key));
      return keys.has(permission) && keys.has("jobs.read");
    })
    .map((m) => m.userId);
}

/**
 * Of these people, the ones still on the job who read the tool — everybody but
 * the person acting, who doesn't need telling what they just did. Somebody
 * taken off the job since shouldn't be pulled back in by a notice.
 */
export async function recipientsOnJob(
  ctx: CompanyContext,
  jobId: string,
  userIds: (string | null)[],
  permission: Permission,
): Promise<string[]> {
  const wanted = [...new Set(userIds.filter((id): id is string => Boolean(id) && id !== ctx.user.id))];
  if (wanted.length === 0) return [];
  const onJob = await ctx.db.jobMember.findMany({
    where: { jobId, userId: { in: wanted } },
    select: { userId: true },
  });
  return readersAmong(ctx, onJob.map((m) => m.userId), permission);
}

/** The job's name, for the text of a notice. */
export async function jobName(ctx: CompanyContext, jobId: string): Promise<string> {
  const job = await ctx.db.job.findFirst({ where: { id: jobId }, select: { name: true } });
  return job?.name ?? "";
}

/**
 * The ids from a form that really are people on this job. Somebody who isn't
 * on it can't be handed its work or put on its events — they couldn't open
 * the page to read it.
 */
export async function membersAmong(ctx: CompanyContext, jobId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const members = await ctx.db.jobMember.findMany({
    where: { jobId, userId: { in: userIds } },
    select: { userId: true },
  });
  const allowed = new Set(members.map((member) => member.userId));
  return userIds.filter((id) => allowed.has(id));
}
