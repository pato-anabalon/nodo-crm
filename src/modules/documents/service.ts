import type { CompanyContext } from "@/lib/auth/session";

export async function listCompanyDocuments(ctx: CompanyContext) {
  return ctx.db.companyDocument.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      url: true,
      size: true,
      isDefault: true,
      createdAt: true,
    },
  });
}

export async function defaultDocumentId(ctx: CompanyContext): Promise<string | null> {
  const doc = await ctx.db.companyDocument.findFirst({
    where: { isDefault: true },
    select: { id: true },
  });
  return doc?.id ?? null;
}
