import type { Permission } from "@/lib/auth/permissions";

/**
 * Whether somebody may edit or delete a piece of authored content — a post, a
 * comment, a chat message, a file.
 *
 * `*.update` and `*.delete` reach only what the person wrote or uploaded
 * themselves; somebody else's needs `jobs.moderate` as well. Content whose
 * author is gone (`authorId` null) belongs to nobody, so only a moderator can
 * touch it.
 */
export function canTouch(
  userId: string,
  permissions: ReadonlySet<Permission>,
  permission: Permission,
  authorId: string | null,
): boolean {
  if (!permissions.has(permission)) return false;
  if (authorId !== null && authorId === userId) return true;
  return permissions.has("jobs.moderate");
}
