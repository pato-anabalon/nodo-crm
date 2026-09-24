import { prisma } from "./prisma";
import { applyTenantScope } from "./tenant-scope";

/**
 * `forCompany(companyId)` returns an extended Prisma client that injects the
 * company filter into every operation. The idea is that module code never writes
 * `where: { companyId }` by hand: if someone forgets, it stays scoped anyway.
 * Queries that must cross companies (sign-up, sign-in, a superadmin panel) use
 * `prisma` directly, explicitly and visibly.
 */
export type TenantClient = ReturnType<typeof forCompany>;

export function forCompany(companyId: string) {
  if (!companyId) {
    throw new Error("forCompany requires a companyId");
  }

  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(applyTenantScope(model, operation, args, companyId) as typeof args);
        },
      },
    },
  });
}

export { applyTenantScope, tenantFilter } from "./tenant-scope";
