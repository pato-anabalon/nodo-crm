/**
 * Places on the map the jobs that existed before jobs had a place.
 *
 * A job is read from its address when the address is saved, so one made
 * before `20261110120000_job_location` has none until somebody edits it — and
 * nobody can clock in on a job with no place. This asks once for each job not
 * yet finished that has an address and has never been asked about
 * (`geocodedAddress` null), exactly as a save would. A job already placed, by
 * either route, is left alone, so running it twice asks nothing twice.
 *
 * Every company, or one with `--company=<slug>`. Counts unless `--apply`.
 * Needs `GOOGLE_GEOCODING_API_KEY`; each address is one billed request.
 *
 * Usage:
 *   npx tsx scripts/geocode-jobs.ts                     # counts only
 *   npx tsx scripts/geocode-jobs.ts --apply
 *   npx tsx scripts/geocode-jobs.ts --company=plasterprosolution --apply
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { geocode } from "../src/lib/geo/geocode";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const apply = process.argv.includes("--apply");
const slug = process.argv.find((arg) => arg.startsWith("--company="))?.slice("--company=".length);

async function main() {
  console.log(`Database: ${new URL(connectionString ?? "postgres://unset").hostname}`);
  if (apply && !process.env.GOOGLE_GEOCODING_API_KEY) throw new Error("GOOGLE_GEOCODING_API_KEY is not set.");

  // Through `prisma` on purpose: a platform task across companies, bounded by each job's own company.
  const jobs = await prisma.job.findMany({
    where: {
      status: { not: "COMPLETED" },
      address: { not: null },
      latitude: null,
      geocodedAddress: null,
      ...(slug ? { company: { slug } } : {}),
    },
    select: { id: true, companyId: true, name: true, address: true, company: { select: { slug: true, formatLocale: true } } },
    orderBy: { createdAt: "asc" },
  });
  const withAddress = jobs.filter((job) => job.address?.trim());
  console.log(`${withAddress.length} job(s) to place${slug ? ` in ${slug}` : ""}.`);
  if (!apply) {
    for (const job of withAddress) console.log(`  ${job.company.slug}  ${job.name}  —  ${job.address}`);
    console.log("Nothing changed. Run again with --apply.");
    return;
  }

  let found = 0;
  for (const job of withAddress) {
    const point = await geocode(job.address!, job.company.formatLocale);
    await prisma.job.update({
      where: { id: job.id, companyId: job.companyId },
      data: point
        ? { latitude: point.latitude, longitude: point.longitude, locationSource: "GEOCODED", geocodedAddress: job.address }
        : { geocodedAddress: job.address },
    });
    if (point) found += 1;
    console.log(`  ${point ? "placed " : "missing"}  ${job.company.slug}  ${job.name}`);
  }
  console.log(`Placed ${found} of ${withAddress.length}; the rest need placing by hand on the job.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
