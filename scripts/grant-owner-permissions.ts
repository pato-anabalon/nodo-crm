/**
 * Gives every company's `OWNER` profile any permission it doesn't hold yet
 * (`grantOwnerPermissions` in src/lib/tenant/provision.ts).
 *
 * Run once per environment after shipping a new permission: `OWNER` can't be
 * edited on the profiles screen, so nobody could tick it for them. Running it
 * again changes nothing.
 *
 * Usage:
 *   npx tsx scripts/grant-owner-permissions.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { grantOwnerPermissions } from "../src/lib/tenant/provision";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

grantOwnerPermissions(prisma)
  .then((result) => {
    console.log(`✓ ${result.owners} owner profiles — ${result.granted} permissions granted`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
