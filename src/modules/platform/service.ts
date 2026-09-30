import { prisma } from "@/lib/db/prisma";
import { MembershipStatus, RoleKey } from "@/generated/prisma/enums";
import { companyUrl } from "@/lib/tenant/host";

export type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  ownerEmail: string | null;
  userCount: number;
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
export async function listCompanies(): Promise<CompanyRow[]> {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      createdAt: true,
      memberships: {
        where: { role: { key: RoleKey.OWNER }, status: MembershipStatus.ACTIVE },
        take: 1,
        select: { user: { select: { email: true } } },
      },
      _count: { select: { memberships: true } },
    },
  });

  return companies.map((company) => ({
    id: company.id,
    slug: company.slug,
    name: company.name,
    isActive: company.isActive,
    createdAt: company.createdAt,
    ownerEmail: company.memberships[0]?.user.email ?? null,
    userCount: company._count.memberships,
    url: companyUrl(company.slug),
  }));
}

/**
 * Flips the same switch `getCompanyContext()` and `getCompanyBySlug()` already
 * check: turning it off shuts the whole subdomain, login included, without
 * touching anything else about the company.
 */
export async function setCompanyActive(companyId: string, isActive: boolean): Promise<void> {
  await prisma.company.update({ where: { id: companyId }, data: { isActive } });
}
