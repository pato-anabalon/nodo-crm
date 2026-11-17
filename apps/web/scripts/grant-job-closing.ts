/**
 * Hands the two permissions that close and reopen a job to the profiles that
 * already look after jobs, in every company.
 *
 * `provision-job-roles.ts` leaves alone any profile that holds a job permission
 * (the company may have trimmed it), so it can't carry a permission added
 * afterwards, and templates are applied once, when a company is created. Without
 * this, `jobs.finish`/`jobs.reopen` would reach only companies created from now on.
 *
 *   jobs.finish → every profile that holds `jobs.update` (the ones that already
 *                 run a job: Admin, Manager, Project Lead, and any custom one)
 *   jobs.reopen → the same, but only Owner, Admin and Manager: undoing a finished
 *                 job is a bigger step than finishing it
 *
 * Counts and changes nothing unless given `--apply`. Idempotent. Syncs the
 * catalogue first, like `grant-owner-permissions.ts`, so production needs no
 * `db:seed`. Reads `DATABASE_URL_UNPOOLED ?? DATABASE_URL` and prints the host.
 *
 * Usage:
 *   npx tsx scripts/grant-job-closing.ts            # what it would do
 *   npx tsx scripts/grant-job-closing.ts --apply
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleKey } from "../src/generated/prisma/client";
import { syncPermissions } from "../src/lib/tenant/provision";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const REOPENERS: RoleKey[] = [RoleKey.OWNER, RoleKey.ADMIN, RoleKey.MANAGER];

async function main() {
  console.log(`Database: ${new URL(connectionString ?? "postgres://unset").hostname}`);
  await syncPermissions(prisma);

  const permissions = await prisma.permission.findMany({
    where: { key: { in: ["jobs.finish", "jobs.reopen", "jobs.update"] } },
    select: { id: true, key: true },
  });
  const id = (key: string) => {
    const found = permissions.find((permission) => permission.key === key)?.id;
    if (!found) throw new Error(`Permission ${key} is not in the catalogue`);
    return found;
  };

  const roles = await prisma.role.findMany({
    select: { id: true, key: true, companyId: true, permissions: { select: { permissionId: true } } },
  });

  const rows: { roleId: string; permissionId: string }[] = [];
  for (const role of roles) {
    const held = new Set(role.permissions.map((row) => row.permissionId));
    if (!held.has(id("jobs.update"))) continue;
    if (!held.has(id("jobs.finish"))) rows.push({ roleId: role.id, permissionId: id("jobs.finish") });
    if (role.key && REOPENERS.includes(role.key) && !held.has(id("jobs.reopen"))) {
      rows.push({ roleId: role.id, permissionId: id("jobs.reopen") });
    }
  }

  const finish = rows.filter((row) => row.permissionId === id("jobs.finish")).length;
  console.log(`${finish} profiles would get jobs.finish, ${rows.length - finish} would get jobs.reopen`);
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
