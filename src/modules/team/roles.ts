import type { CompanyContext } from "@/lib/auth/session";
import { RoleKey } from "@/generated/prisma/enums";
import { isPermission, type Permission } from "@/lib/auth/permissions";
import { isRoleEditable } from "./rules";

/** One profile with the features it currently holds. */
export async function getRoleDetail(ctx: CompanyContext, id: string) {
  const role = await ctx.db.role.findFirst({
    where: { id },
    include: { permissions: { include: { permission: { select: { key: true } } } } },
  });
  if (!role) return null;

  return {
    id: role.id,
    key: role.key,
    name: role.name,
    editable: isRoleEditable(role.key),
    permissions: role.permissions
      .map((row) => row.permission.key)
      .filter(isPermission) as Permission[],
  };
}

export type RoleUpdateOutcome = { ok: true } | { ok: false; reason: "not-found" | "locked" };

/**
 * Replaces a profile's features with exactly the ones ticked.
 *
 * Written as a delete-then-insert inside one transaction rather than a diff:
 * the grid always submits the whole set, so working out what changed would add
 * a way for the stored permissions to drift from what the screen showed.
 *
 * `OWNER` is refused here and not only hidden in the UI — it is the profile that
 * can undo a mistake made on this very screen.
 */
export async function setRolePermissions(
  ctx: CompanyContext,
  id: string,
  keys: string[],
): Promise<RoleUpdateOutcome> {
  const role = await ctx.db.role.findFirst({ where: { id }, select: { id: true, key: true } });
  if (!role) return { ok: false, reason: "not-found" };
  if (!isRoleEditable(role.key)) return { ok: false, reason: "locked" };

  const wanted = keys.filter(isPermission);

  const permissions = await ctx.db.permission.findMany({
    where: { key: { in: wanted } },
    select: { id: true },
  });

  await ctx.db.$transaction([
    ctx.db.rolePermission.deleteMany({ where: { roleId: role.id } }),
    ctx.db.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    }),
  ]);

  return { ok: true };
}

/** The order profiles are shown in: most powerful first. */
export const ROLE_ORDER: readonly RoleKey[] = Object.values(RoleKey);
