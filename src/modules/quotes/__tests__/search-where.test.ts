jest.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import type { CompanyContext } from "@/lib/auth/session";
import { buildQuoteWhere } from "../service";
import type { QuoteFilters } from "../schemas";

const ctx = { permissions: new Set(["quotes.read.all"]), user: { id: "u1" } } as unknown as CompanyContext;

function searchClauses(q: string) {
  const where = buildQuoteWhere(ctx, { page: 1, section: "all", q } as QuoteFilters);
  const and = where.AND as Array<{ OR?: unknown[] }>;
  return and[0].OR as Array<Record<string, unknown>>;
}

describe("buildQuoteWhere — text search", () => {
  it("also searches the project address, case-insensitively", () => {
    expect(searchClauses("Irene")).toContainEqual({
      projectAddress: { contains: "Irene", mode: "insensitive" },
    });
  });

  it("keeps searching title, lead title and number", () => {
    const clauses = searchClauses("COT-000123");
    expect(clauses).toContainEqual({ title: { contains: "COT-000123", mode: "insensitive" } });
    expect(clauses).toContainEqual({ lead: { title: { contains: "COT-000123", mode: "insensitive" } } });
    expect(clauses).toContainEqual({ number: 123 });
  });
});
