import type { Prisma } from "@/generated/prisma/client";
import type { Permission } from "@/lib/auth/permissions";

/**
 * Which jobs somebody can see: every one with `jobs.read.all`, otherwise only
 * the ones they are a member of.
 *
 * Pure, so it can be checked without a database — getting it wrong is
 * invisible, because the list simply contains a job it shouldn't.
 */
export function jobVisibilityWhere(
  userId: string,
  permissions: ReadonlySet<Permission>,
): Prisma.JobWhereInput {
  if (permissions.has("jobs.read.all")) return {};
  return { members: { some: { userId } } };
}
