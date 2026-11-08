import type { CompanyContext } from "@/lib/auth/session";
import { InvitationStatus, RoleKey } from "@/generated/prisma/enums";
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
    /** Made by the company, rather than one of the standard profiles. */
    custom: !role.isSystem,
    /** Every profile but the owner's. */
    deletable: role.key !== RoleKey.OWNER,
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

/**
 * Gives a profile the company's own name, or takes it back to the standard one
 * (`null`).
 *
 * Unlike the permissions, `OWNER` can be renamed: the name is only a label, and
 * an IT company whose owners are "Directors" loses nothing by saying so. What
 * keeps the profile special is its `key`, which this never touches.
 */
export async function renameRole(
  ctx: CompanyContext,
  id: string,
  name: string | null,
): Promise<{ ok: true } | { ok: false; reason: "not-found" | "name-required" }> {
  const role = await ctx.db.role.findFirst({ where: { id }, select: { isSystem: true } });
  if (!role) return { ok: false, reason: "not-found" };
  // A profile the company made has no standard name to fall back to: emptying
  // it would leave a profile that is called nothing.
  if (!role.isSystem && name === null) return { ok: false, reason: "name-required" };

  await ctx.db.role.updateMany({ where: { id }, data: { name } });
  return { ok: true };
}

export type CreateRoleOutcome = { ok: true; id: string } | { ok: false; reason: "not-found" };

/**
 * Makes a profile of the company's own.
 *
 * It can start from another profile's features (`copyFrom`) or from nothing.
 * Copying is the usual way in: an "IT support" profile is "Sales" with a few
 * ticks moved, and a blank grid of sixty boxes is not a place anybody wants to
 * start. What is copied is the features held *now*, as a snapshot — the two
 * profiles go their own ways from there.
 *
 * `OWNER` can be copied: nothing here grants more than the person making it
 * could already do by ticking the same boxes on any other profile.
 */
export async function createRole(
  ctx: CompanyContext,
  input: { name: string; copyFrom: string | null },
): Promise<CreateRoleOutcome> {
  const source = input.copyFrom
    ? await ctx.db.role.findFirst({
        where: { id: input.copyFrom },
        select: { permissions: { select: { permissionId: true } } },
      })
    : null;
  if (input.copyFrom && !source) return { ok: false, reason: "not-found" };

  const role = await ctx.db.role.create({
    data: { companyId: ctx.company.id, key: null, name: input.name, isSystem: false },
    select: { id: true },
  });

  if (source && source.permissions.length > 0) {
    await ctx.db.rolePermission.createMany({
      data: source.permissions.map(({ permissionId }) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  return { ok: true, id: role.id };
}

export type DeleteRoleOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" | "owner" }
  // How many people hold it and how many invitations wait for it, so the message
  // can say what has to be moved before it can go.
  | { ok: false; reason: "in-use"; members: number; invitations: number };

/**
 * Deletes a profile.
 *
 * Any of them but `OWNER`: that one is what can undo a mistake made on this very
 * screen, and the "last owner" rules lean on it. It is refused here and not only
 * hidden on the screen. A profile somebody still holds is refused too — people and pending invitations both
 * point at it, and deleting it would either fail on the key or leave them
 * holding nothing; moving them first is a decision for a person. Invitations
 * already answered or revoked are history and go with it.
 */
export async function deleteRole(ctx: CompanyContext, id: string): Promise<DeleteRoleOutcome> {
  const role = await ctx.db.role.findFirst({
    where: { id },
    select: {
      key: true,
      _count: { select: { memberships: true } },
    },
  });
  if (!role) return { ok: false, reason: "not-found" };
  if (role.key === RoleKey.OWNER) return { ok: false, reason: "owner" };

  const pending = await ctx.db.invitation.count({ where: { roleId: id, status: InvitationStatus.PENDING } });
  if (role._count.memberships > 0 || pending > 0) {
    return { ok: false, reason: "in-use", members: role._count.memberships, invitations: pending };
  }

  await ctx.db.invitation.deleteMany({ where: { roleId: id } });
  await ctx.db.role.deleteMany({ where: { id } });
  return { ok: true };
}
