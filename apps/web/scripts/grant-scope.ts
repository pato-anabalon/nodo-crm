/**
 * Hands the scope of work's two permissions to the profiles that already had
 * what they replace, in every company.
 *
 * Until `scope.read` existed, anybody who could open a job read its scope, and
 * nobody could change it. So every profile holding `jobs.read` gets
 * `scope.read` — nobody stops seeing what they saw — and every profile holding
 * `jobs.update`, the people who already fix a job's name and address, gets
 * `scope.update`. Custom profiles are included on the same rule: it is what
 * they could already do, not a new decision. Each company trims it on the
 * profiles screen from there.
 *
 * Templates are applied once, when a company is created, so without this the
 * scope would vanish from every existing company's jobs. A profile that already
 * holds a `scope.*` permission is left as it is, so running it after a company
 * trimmed one changes nothing.
 *
 * Counts and changes nothing unless given `--apply`. Idempotent. Syncs the
 * catalogue first, like `grant-timeclock.ts`, so production needs no
 * `db:seed`. Reads `DATABASE_URL_UNPOOLED ?? DATABASE_URL` and prints the host.
 *
 * Usage:
 *   npx tsx scripts/grant-scope.ts            # what it would do
 *   npx tsx scripts/grant-scope.ts --apply
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncPermissions } from "../src/lib/tenant/provision";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** What each new permission follows: whoever held the one on the right gets the one on the left. */
const FOLLOWS = { "scope.read": "jobs.read", "scope.update": "jobs.update" } as const;

async function main() {
  console.log(`Database: ${new URL(connectionString ?? "postgres://unset").hostname}`);
  await syncPermissions(prisma);

  const catalogue = await prisma.permission.findMany({
    where: { key: { in: [...Object.keys(FOLLOWS), ...Object.values(FOLLOWS)] } },
    select: { id: true, key: true },
  });
  const idOf = new Map(catalogue.map((permission) => [permission.key, permission.id]));
  const scopeIds = new Set(Object.keys(FOLLOWS).map((key) => idOf.get(key)));

  const roles = await prisma.role.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      company: { select: { slug: true } },
      permissions: { select: { permissionId: true } },
    },
  });

  const rows: { roleId: string; permissionId: string }[] = [];
  for (const role of roles) {
    const held = new Set(role.permissions.map((row) => row.permissionId));
    if ([...held].some((id) => scopeIds.has(id))) continue;

    const wanted = Object.entries(FOLLOWS)
      .filter(([, follows]) => held.has(idOf.get(follows)!))
      .map(([key]) => key);
    for (const key of wanted) {
      const permissionId = idOf.get(key);
      if (!permissionId) throw new Error(`Permission ${key} is not in the catalogue`);
      rows.push({ roleId: role.id, permissionId });
    }
    if (wanted.length) console.log(`  ${role.company.slug}  ${role.key ?? role.name}  ${wanted.join(", ")}`);
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
