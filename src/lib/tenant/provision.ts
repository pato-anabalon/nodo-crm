import type { PrismaClient } from "@/generated/prisma/client";
import { RoleKey } from "@/generated/prisma/enums";
import { ALL_PERMISSIONS, permissionModule, type Permission } from "@/lib/auth/permissions";
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
 * Creates a company with its five standard profiles and leaves the given user as
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
