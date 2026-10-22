/**
 * Gives every company's `OWNER` profile any permission it doesn't hold yet
 * (`grantOwnerPermissions` in src/lib/tenant/provision.ts).
 *
 * Run once per environment after shipping a new permission: `OWNER` can't be
 * edited on the profiles screen, so nobody could tick it for them. Running it
 * again changes nothing.
 *
 * It syncs the permission catalogue first (the same `syncPermissions` that
 * `db:seed` runs), so it can stand in for the seed where that must not run: the
 * seed also creates a demo user and company, which has no place in production.
 * Reads `DATABASE_URL_UNPOOLED ?? DATABASE_URL` like the other data scripts and
 * prints the host it is talking to.
 *
 * Usage:
 *   npx tsx scripts/grant-owner-permissions.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { grantOwnerPermissions, syncPermissions } from "../src/lib/tenant/provision";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

console.log(`Database: ${new URL(connectionString ?? "postgres://unset").hostname}`);

syncPermissions(prisma)
  .then((total) => {
    console.log(`✓ ${total} permissions synced`);
    return grantOwnerPermissions(prisma);
  })
  .then((result) => {
    console.log(`✓ ${result.owners} owner profiles — ${result.granted} permissions granted`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
