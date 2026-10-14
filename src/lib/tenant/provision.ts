import type { PrismaClient } from "@/generated/prisma/client";
import { RoleKey } from "@/generated/prisma/enums";
import { ALL_PERMISSIONS, isPermission, permissionModule, type Permission } from "@/lib/auth/permissions";
import { ROLE_TEMPLATES, templatePermissions } from "@/lib/auth/role-templates";

type Db = Pick<PrismaClient, "permission" | "company" | "role" | "rolePermission" | "membership" | "user">;

/**
 * Syncs the `Permission` table with the catalogue in code.
 * Idempotent: safe to run on every deploy.
 */
export async function syncPermissions(db: Db): Promise<number> {
  for (const key of ALL_PERMISSIONS) {
    await db.permission.upsert({
      where: { key },
      create: { key, module: permissionModule(key) },
      update: { module: permissionModule(key) },
    });
  }
  return ALL_PERMISSIONS.length;
}

/**
 * Creates a company with its standard profiles and leaves the given user as
 * the owner. It runs inside a transaction so a half-built company (without
 * profiles, or without an owner) can never be left behind.
 */
export async function createCompanyWithOwner(
  prisma: PrismaClient,
  input: {
    name: string;
    slug: string;
    ownerUserId: string;
    currency?: string;
    formatLocale?: string;
    timezone?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.name,
        slug: input.slug,
        currency: input.currency ?? "NZD",
        formatLocale: input.formatLocale ?? "en-NZ",
        timezone: input.timezone ?? "Pacific/Auckland",
      },
    });

    const permissions = await tx.permission.findMany();
    const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

    let ownerRoleId: string | null = null;

    for (const template of ROLE_TEMPLATES) {
      const role = await tx.role.create({
        data: {
          // Name and description stay null on purpose: they're translated from
          // `key`, and only filled in when a company renames the profile.
          companyId: company.id,
          key: template.key,
          isSystem: true,
        },
      });

      if (template.key === RoleKey.OWNER) ownerRoleId = role.id;

      const keys = templatePermissions(template);
      const rows = keys
        .map((key: Permission) => permissionIdByKey.get(key))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId }));

      if (rows.length > 0) {
        await tx.rolePermission.createMany({ data: rows, skipDuplicates: true });
      }
    }

    if (!ownerRoleId) {
      throw new Error("Owner profile was not created");
    }

    await tx.membership.create({
      data: { userId: input.ownerUserId, companyId: company.id, roleId: ownerRoleId },
    });

    return company;
  });
}

/** The modules a role template reaches into when Jobs arrived. */
const JOB_MODULES = new Set<string>(["jobs", "messages", "comments", "todos", "files", "schedule", "chat", "lineup"]);

export function isJobPermission(permission: Permission): boolean {
  return JOB_MODULES.has(permissionModule(permission));
}

/**
 * Brings companies created before Jobs up to date: the standard profiles they
 * don't have yet (PROJECT_LEAD, TEAM_LEAD, WORKER, COLLABORATOR) are created
 * from their templates, and the profiles they do have are granted their
 * template's job permissions.
 *
 * `syncPermissions` alone wouldn't do it: it fills the catalogue but never
 * touches a company's grants, and templates are only read when a company is
 * created.
 *
 * Safe to run twice. A role that already holds **any** job permission is left
 * alone, so a company that has since trimmed a profile on the grid doesn't get
 * the trimmed permissions back.
 */
export async function provisionJobRoles(
  prisma: PrismaClient,
): Promise<{ companies: number; rolesCreated: number; rolesGranted: number }> {
  await syncPermissions(prisma);
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));
  const idsFor = (keys: Permission[]) =>
    keys.map((key) => permissionIdByKey.get(key)).filter((id): id is string => Boolean(id));

  const companies = await prisma.company.findMany({ select: { id: true } });
  let rolesCreated = 0;
  let rolesGranted = 0;

  for (const company of companies) {
    const roles = await prisma.role.findMany({
      where: { companyId: company.id },
      select: { id: true, key: true, permissions: { select: { permission: { select: { key: true } } } } },
    });

    for (const template of ROLE_TEMPLATES) {
      const keys = templatePermissions(template);
      const existing = roles.find((role) => role.key === template.key);

      if (!existing) {
        await prisma.$transaction(async (tx) => {
          const role = await tx.role.create({
            data: { companyId: company.id, key: template.key, isSystem: true },
          });
          await tx.rolePermission.createMany({
            data: idsFor(keys).map((permissionId) => ({ roleId: role.id, permissionId })),
            skipDuplicates: true,
          });
        });
        rolesCreated++;
        continue;
      }

      const held = existing.permissions.map((row) => row.permission.key);
      if (held.some((key) => isPermission(key) && isJobPermission(key))) continue;

      const jobKeys = keys.filter(isJobPermission);
      if (jobKeys.length === 0) continue;
      await prisma.rolePermission.createMany({
        data: idsFor(jobKeys).map((permissionId) => ({ roleId: existing.id, permissionId })),
        skipDuplicates: true,
      });
      rolesGranted++;
    }
  }

  return { companies: companies.length, rolesCreated, rolesGranted };
}
