import { prisma } from "@/lib/db/prisma";
import { MembershipStatus, RoleKey } from "@/generated/prisma/enums";
import { companyUrl } from "@/lib/tenant/host";
import { companyStatus, demoEndsAt, STATUS_ORDER, type CompanyStatus } from "./status";

export type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  ownerEmail: string | null;
  userCount: number;
  /** Why it is on or off — see `companyStatus`. */
  status: CompanyStatus;
  /** Kept as they were last set, so a dialog can offer them back. */
  isDemo: boolean;
  demoDays: number | null;
  demoStartedAt: Date | null;
  demoEndsAt: Date | null;
  /** The company's own subdomain, built server-side: a client component can't
   * be handed the `companyUrl` function itself to call on its own. */
  url: string;
};

/**
 * Every company on the platform, for the one screen that isn't bounded to a
 * single tenant. Deliberately outside `ctx.db`: there is no company to scope
 * this to, the same reason the daily sweep and the ingest path go through
 * `prisma` directly.
 */
export async function listCompanies(now: Date = new Date()): Promise<CompanyRow[]> {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      approvedAt: true,
      isDemo: true,
      demoDays: true,
      demoStartedAt: true,
      demoEndsAt: true,
      demoEndedAt: true,
      createdAt: true,
      memberships: {
        where: { role: { key: RoleKey.OWNER }, status: MembershipStatus.ACTIVE },
        take: 1,
        select: { user: { select: { email: true } } },
      },
      _count: { select: { memberships: true } },
    },
  });

  const rows = companies.map((company) => ({
    id: company.id,
    slug: company.slug,
    name: company.name,
    isActive: company.isActive,
    createdAt: company.createdAt,
    ownerEmail: company.memberships[0]?.user.email ?? null,
    userCount: company._count.memberships,
    status: companyStatus(company, now),
    isDemo: company.isDemo,
    demoDays: company.demoDays,
    demoStartedAt: company.demoStartedAt,
    demoEndsAt: company.demoEndsAt,
    url: companyUrl(company.slug),
  }));

  // The ones waiting on somebody come first: a company that just signed up
  // should not be found by scrolling. The query already ordered by newest, and
  // `sort` is stable, so each group keeps it.
  return rows.sort((a, b) => STATUS_ORDER[a.status.kind] - STATUS_ORDER[b.status.kind]);
}

/**
 * Switches a company on, as a demo of `days` days or with no limit.
 *
 * The demo clock starts here, not at sign-up: the wait for approval isn't the
 * company's to spend. Activating one that ran out starts a fresh demo, which is
 * what "extend" means. Idempotent in the sense that matters — pressing it twice
 * leaves the same company on, with the second press's clock.
 */
export async function activateCompany(
  companyId: string,
  demo: { days: number } | null,
  now: Date = new Date(),
): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { approvedAt: true } });
  if (!company) return;

  await prisma.company.update({
    where: { id: companyId },
    data: {
      isActive: true,
      // Only the first switch-on is "approval"; later ones are reactivations.
      approvedAt: company.approvedAt ?? now,
      demoEndedAt: null,
      demoWarnedAt: null,
      ...(demo
        ? { isDemo: true, demoDays: demo.days, demoStartedAt: now, demoEndsAt: demoEndsAt(now, demo.days) }
        : { isDemo: false, demoDays: null, demoStartedAt: null, demoEndsAt: null }),
    },
  });
}

/**
 * Flips the same switch `getCompanyContext()` and `getCompanyBySlug()` already
 * check: turning it off shuts the whole subdomain, login included, without
 * touching anything else about the company. A demo keeps its settings, so
 * activating it again offers them back.
 */
export async function suspendCompany(companyId: string): Promise<void> {
  await prisma.company.update({ where: { id: companyId }, data: { isActive: false } });
}

/**
 * Changes how long a demo that is running lasts, counting from when it started.
 * Returns false when the company isn't a running demo, so a stale screen can't
 * quietly turn a customer into one.
 */
export async function setDemoDays(companyId: string, days: number): Promise<boolean> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, isActive: true, isDemo: true },
    select: { demoStartedAt: true },
  });
  if (!company) return false;

  const startedAt = company.demoStartedAt ?? new Date();
  await prisma.company.update({
    where: { id: companyId },
    // The warning is cleared too: a demo that was extended is warned again
    // before its new end, not left unwarned because it was warned before.
    data: { demoDays: days, demoStartedAt: startedAt, demoEndsAt: demoEndsAt(startedAt, days), demoWarnedAt: null },
  });
  return true;
}

/** Ends the demo and leaves the company on with no limit. */
export async function convertToCustomer(companyId: string): Promise<boolean> {
  const { count } = await prisma.company.updateMany({
    where: { id: companyId, isActive: true, isDemo: true },
    data: { isDemo: false, demoDays: null, demoStartedAt: null, demoEndsAt: null, demoEndedAt: null, demoWarnedAt: null },
  });
  return count === 1;
}
