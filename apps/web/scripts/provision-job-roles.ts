/**
 * Brings every existing company up to date with the Jobs module's profiles
 * and permissions (`provisionJobRoles` in src/lib/tenant/provision.ts).
 *
 * Run once per environment after applying the `jobs_base` migration — the
 * migration adds the RoleKey values, this creates the rows that use them.
 * Running it again changes nothing.
 *
 * Usage:
 *   npx tsx scripts/provision-job-roles.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { provisionJobRoles } from "../src/lib/tenant/provision";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

provisionJobRoles(prisma)
  .then((result) => {
    console.log(
      `✓ ${result.companies} companies — ${result.rolesCreated} profiles created, ${result.rolesGranted} profiles granted job permissions`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
