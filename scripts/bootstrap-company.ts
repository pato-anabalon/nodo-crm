/**
 * Creates a company and its owner user, outside the normal registration form.
 *
 * Meant for bootstrapping a company before a historical data import
 * (scripts/import-quotient-data.ts, scripts/download-quotient-pdfs.ts) has
 * anywhere to write to. It does exactly what `registerCompany` does
 * (src/app/register/actions.ts) — `syncPermissions` + `createCompanyWithOwner`
 * — so the result is indistinguishable from a company that signed up through
 * the form: same five standard profiles, same permissions, same membership.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-company.ts \
 *     --slug=plasterpro-test \
 *     --company-name="Plaster Pro Solution" \
 *     --owner-name="Rolando Reveco" \
 *     --owner-email=rolando@plasterprosolution.co.nz \
 *     --owner-password=<temporary password> \
 *     [--currency=NZD] [--format-locale=en-NZ] [--timezone=Pacific/Auckland]
 *
 * All values are flags — the same script bootstraps today's local test
 * company and, later, the real one in production, just by pointing
 * DATABASE_URL/DATABASE_URL_UNPOOLED elsewhere and changing the flags.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createCompanyWithOwner, syncPermissions } from "../src/lib/tenant/provision";
import { isReservedSlug, isValidSlug } from "../src/lib/tenant/host";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function requireArg(args: Record<string, string>, key: string): string {
  const value = args[key];
  if (!value) {
    console.error(`Missing required flag --${key}`);
    process.exit(1);
  }
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL }),
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const slug = requireArg(args, "slug").toLowerCase().trim();
  const companyName = requireArg(args, "company-name");
  const ownerName = requireArg(args, "owner-name");
  const ownerEmail = requireArg(args, "owner-email").toLowerCase().trim();
  const ownerPassword = requireArg(args, "owner-password");
  const currency = args.currency ?? "NZD";
  const formatLocale = args["format-locale"] ?? "en-NZ";
  const timezone = args.timezone ?? "Pacific/Auckland";

  if (!isValidSlug(slug) || isReservedSlug(slug)) {
    console.error(`"${slug}" is not a usable company slug.`);
    process.exit(1);
  }

  const [existingCompany, existingUser] = await Promise.all([
    prisma.company.findUnique({ where: { slug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } }),
  ]);

  if (existingCompany) {
    console.error(`A company with slug "${slug}" already exists — nothing was changed.`);
    process.exit(1);
  }
  if (existingUser) {
    console.error(`A user with email "${ownerEmail}" already exists — nothing was changed.`);
    process.exit(1);
  }

  const permissionCount = await syncPermissions(prisma);
  console.log(`✓ ${permissionCount} permissions synced`);

  const owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      name: ownerName,
      passwordHash: await bcrypt.hash(ownerPassword, 10),
      emailVerified: new Date(),
    },
  });

  const company = await createCompanyWithOwner(prisma, {
    name: companyName,
    slug,
    ownerUserId: owner.id,
    currency,
    formatLocale,
    timezone,
  });

  console.log("✓ Company created:");
  console.log(`  slug:     ${company.slug}`);
  console.log(`  name:     ${company.name}`);
  console.log(`  id:       ${company.id}`);
  console.log("✓ Owner created:");
  console.log(`  email:    ${owner.email}`);
  console.log(`  password: ${ownerPassword}`);
  console.log("");
  console.log("Copy the password now — it is not written to any log file.");
  console.log(
    "legalName, taxId, address, logo and the quote texts are not set here; " +
      "fill them in from /settings/company after signing in, same as any other company.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
