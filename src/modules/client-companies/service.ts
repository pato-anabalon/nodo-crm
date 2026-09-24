import type { CompanyContext } from "@/lib/auth/session";
import { Prisma } from "@/generated/prisma/client";
import { normaliseCompanyName } from "./identity";
import type { ClientCompanyFormValues, ClientCompanyFilters } from "./schemas";

export const CLIENT_COMPANIES_PAGE_SIZE = 20;

function buildWhere(filters: ClientCompanyFilters): Prisma.ClientCompanyWhereInput {
  if (!filters.q) return {};
  const q = filters.q;

  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { taxId: { contains: q, mode: "insensitive" } },
      // On screen, so searchable: a column somebody can read but not find by
      // teaches them the search is unreliable.
      { phone: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
    ],
  };
}

export async function listClientCompanies(ctx: CompanyContext, filters: ClientCompanyFilters) {
  const where = buildWhere(filters);

  const [items, total] = await Promise.all([
    ctx.db.clientCompany.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (filters.page - 1) * CLIENT_COMPANIES_PAGE_SIZE,
      take: CLIENT_COMPANIES_PAGE_SIZE,
      include: { _count: { select: { contacts: true, leads: true } } },
    }),
    ctx.db.clientCompany.count({ where }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / CLIENT_COMPANIES_PAGE_SIZE)),
  };
}

/**
 * One customer's company with everything hanging off it.
 *
 * The people and the work are both here because that is the whole point of the
 * record: the same business enquiring through three different employees over two
 * years only makes sense seen together.
 */
export async function getClientCompany(ctx: CompanyContext, id: string) {
  return ctx.db.clientCompany.findFirst({
    where: { id },
    include: {
      contacts: { orderBy: [{ firstName: "asc" }, { lastName: "asc" }] },
      leads: {
        orderBy: { createdAt: "desc" },
        include: {
          quotes: {
            orderBy: { createdAt: "desc" },
            select: { id: true, number: true, title: true, status: true, total: true, currency: true },
          },
        },
      },
    },
  });
}

export async function createClientCompany(ctx: CompanyContext, values: ClientCompanyFormValues) {
  return ctx.db.clientCompany.create({
    data: { companyId: ctx.company.id, ...values, name: normaliseCompanyName(values.name)! },
  });
}

export async function updateClientCompany(
  ctx: CompanyContext,
  id: string,
  values: ClientCompanyFormValues,
): Promise<boolean> {
  const { count } = await ctx.db.clientCompany.updateMany({
    where: { id },
    data: { ...values, name: normaliseCompanyName(values.name)! },
  });
  return count > 0;
}

/**
 * Removes the company without touching its people or their work.
 *
 * Both links are `SetNull`, so the contacts and the leads stay exactly where
 * they are. Deleting a grouping should not delete what was grouped.
 */
export async function deleteClientCompany(ctx: CompanyContext, id: string): Promise<boolean> {
  const { count } = await ctx.db.clientCompany.deleteMany({ where: { id } });
  return count > 0;
}
