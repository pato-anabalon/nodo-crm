/**
 * Hands the clock's permissions to the standard profiles of every company, as
 * their templates have them: punching to everybody who works on site, seeing
 * and correcting other people's hours to Admin, Manager and Project Lead, and
 * exporting them to Owner alone.
 *
 * Templates are applied once, when a company is created, so without this the
 * clock would reach only companies created from now on. Profiles a company
 * made itself get nothing: what they do is that company's decision, on the
 * profiles screen. A profile that already holds a `timeclock.*` permission is
 * left as it is, so running it after a company trimmed one changes nothing.
 *
 * Counts and changes nothing unless given `--apply`. Idempotent. Syncs the
 * catalogue first, like `grant-owner-permissions.ts`, so production needs no
 * `db:seed`. Reads `DATABASE_URL_UNPOOLED ?? DATABASE_URL` and prints the host.
 *
 * Usage:
 *   npx tsx scripts/grant-timeclock.ts            # what it would do
 *   npx tsx scripts/grant-timeclock.ts --apply
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { roleTemplate, templatePermissions } from "../src/lib/auth/role-templates";
import { syncPermissions } from "../src/lib/tenant/provision";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log(`Database: ${new URL(connectionString ?? "postgres://unset").hostname}`);
  await syncPermissions(prisma);

  const catalogue = await prisma.permission.findMany({
    where: { key: { startsWith: "timeclock." } },
    select: { id: true, key: true },
  });
  const idOf = new Map(catalogue.map((permission) => [permission.key, permission.id]));
  const clockIds = new Set(catalogue.map((permission) => permission.id));

  const roles = await prisma.role.findMany({
    where: { key: { not: null } },
    select: { id: true, key: true, company: { select: { slug: true } }, permissions: { select: { permissionId: true } } },
  });

  const rows: { roleId: string; permissionId: string }[] = [];
  for (const role of roles) {
    if (role.permissions.some((row) => clockIds.has(row.permissionId))) continue;
    const wanted = templatePermissions(roleTemplate(role.key!)).filter((key) => key.startsWith("timeclock."));
    for (const key of wanted) {
      const permissionId = idOf.get(key);
      if (!permissionId) throw new Error(`Permission ${key} is not in the catalogue`);
      rows.push({ roleId: role.id, permissionId });
    }
    if (wanted.length) console.log(`  ${role.company.slug}  ${role.key}  ${wanted.join(", ")}`);
  }

  console.log(`${rows.length} grants to write`);
  if (!apply) {
    console.log("Nothing changed. Run again with --apply.");
    return;
  }
  const { count } = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
  console.log(`✓ ${count} grants written`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
