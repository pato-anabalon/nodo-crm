import type { CompanyContext } from "@/lib/auth/session";
import { Prisma } from "@/generated/prisma/client";
import type { CatalogueFilters, CatalogueItemValues } from "./schemas";

function buildWhere(filters: CatalogueFilters): Prisma.CatalogueItemWhereInput {
  const where: Prisma.CatalogueItemWhereInput = {};
  if (!filters.includeRetired) where.active = true;

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listCatalogue(ctx: CompanyContext, filters: CatalogueFilters) {
  return ctx.db.catalogueItem.findMany({
    where: buildWhere(filters),
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

/** Whether the quote form's "from catalogue" picker has anything to offer at
 * all — cheap enough to check on every quote page without loading the list
 * itself, which is what the picker searches for instead. */
export async function hasActiveCatalogue(ctx: CompanyContext): Promise<boolean> {
  const first = await ctx.db.catalogueItem.findFirst({
    where: { active: true },
    select: { id: true },
  });
  return first !== null;
}

/** What the quote form's "from catalogue" combobox calls on every keystroke,
 * searched and bounded — never the whole price list at once. */
export async function searchActiveCatalogue(ctx: CompanyContext, query: string) {
  return ctx.db.catalogueItem.findMany({
    where: buildWhere({ q: query.trim() || undefined, includeRetired: false }),
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, description: true, unit: true, unitPrice: true },
  });
}

export async function createCatalogueItem(ctx: CompanyContext, values: CatalogueItemValues) {
  return ctx.db.catalogueItem.create({
    data: { companyId: ctx.company.id, ...values },
  });
}

export async function updateCatalogueItem(
  ctx: CompanyContext,
  id: string,
  values: CatalogueItemValues,
): Promise<boolean> {
  const { count } = await ctx.db.catalogueItem.updateMany({ where: { id }, data: values });
  return count > 0;
}

/**
 * Retires a line instead of deleting it.
 *
 * Quotes carry their own copy of every price, so a delete would lose nothing on
 * them — but it would lose the list this company built, and there is no way back
 * from that. Retiring takes it out of the picker and leaves it findable.
 */
export async function setCatalogueItemActive(
  ctx: CompanyContext,
  id: string,
  active: boolean,
): Promise<boolean> {
  const { count } = await ctx.db.catalogueItem.updateMany({ where: { id }, data: { active } });
  return count > 0;
}
