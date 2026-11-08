import { applyTenantScope, tenantFilter } from "../tenant-scope";

const COMPANY = "company_a";
const OTHER = "company_b";

describe("tenantFilter", () => {
  it("filters by companyId on models with their own column", () => {
    expect(tenantFilter("Lead", COMPANY)).toEqual({ companyId: COMPANY });
    expect(tenantFilter("Quote", COMPANY)).toEqual({ companyId: COMPANY });
  });

  it("filters through the relation on models that inherit the company", () => {
    expect(tenantFilter("QuoteItem", COMPANY)).toEqual({
      quote: { is: { companyId: COMPANY } },
    });
  });

  it("does not filter global models", () => {
    expect(tenantFilter("User", COMPANY)).toBeNull();
    expect(tenantFilter("Permission", COMPANY)).toBeNull();
    expect(tenantFilter("Session", COMPANY)).toBeNull();
  });
});

describe("applyTenantScope — reads", () => {
  it("adds the filter when no where came in", () => {
    expect(applyTenantScope("Lead", "findMany", {}, COMPANY)).toEqual({
      where: { companyId: COMPANY },
    });
  });

  it("keeps the caller's where and adds the company to it", () => {
    const args = { where: { status: "NEW" }, take: 10 };
    expect(applyTenantScope("Lead", "findMany", args, COMPANY)).toEqual({
      where: { AND: [{ status: "NEW" }, { companyId: COMPANY }] },
      take: 10,
    });
  });

  it("scopes findUnique, which is where someone else's id would leak through", () => {
    const scoped = applyTenantScope("Lead", "findUnique", { where: { id: "lead_1" } }, COMPANY);
    expect(scoped).toEqual({
      where: { id: "lead_1", companyId: COMPANY },
    });
  });

  it("scopes count, aggregate and groupBy", () => {
    for (const op of ["count", "aggregate", "groupBy"]) {
      expect(applyTenantScope("Quote", op, {}, COMPANY)).toMatchObject({
        where: { companyId: COMPANY },
      });
    }
  });

  it("scopes quote lines through their quote", () => {
    expect(applyTenantScope("QuoteItem", "findMany", {}, COMPANY)).toEqual({
      where: { quote: { is: { companyId: COMPANY } } },
    });
  });

  it("leaves queries on global models untouched", () => {
    const args = { where: { email: "a@b.cl" } };
    expect(applyTenantScope("User", "findUnique", args, COMPANY)).toBe(args);
  });
});

describe("applyTenantScope — writes", () => {
  it("injects the company on create", () => {
    expect(applyTenantScope("Lead", "create", { data: { title: "x" } }, COMPANY)).toEqual({
      data: { title: "x", companyId: COMPANY },
    });
  });

  it("overwrites a foreign companyId sent by the caller", () => {
    const scoped = applyTenantScope(
      "Lead",
      "create",
      { data: { title: "x", companyId: OTHER } },
      COMPANY,
    ) as { data: { companyId: string } };
    expect(scoped.data.companyId).toBe(COMPANY);
  });

  it("injects the company into every row of createMany", () => {
    const scoped = applyTenantScope(
      "Contact",
      "createMany",
      { data: [{ firstName: "a" }, { firstName: "b" }] },
      COMPANY,
    ) as { data: Array<{ companyId: string }> };
    expect(scoped.data).toEqual([
      { firstName: "a", companyId: COMPANY },
      { firstName: "b", companyId: COMPANY },
    ]);
  });

  it("scopes update and delete so they can't touch another company's rows", () => {
    expect(applyTenantScope("Lead", "update", { where: { id: "l1" }, data: { score: 5 } }, COMPANY))
      .toEqual({
        where: { id: "l1", companyId: COMPANY },
        data: { score: 5 },
      });

    expect(applyTenantScope("Lead", "delete", { where: { id: "l1" } }, COMPANY)).toEqual({
      where: { id: "l1", companyId: COMPANY },
    });
  });

  it("scopes deleteMany with no where, which would otherwise wipe the table", () => {
    expect(applyTenantScope("Lead", "deleteMany", {}, COMPANY)).toEqual({
      where: { companyId: COMPANY },
    });
    expect(applyTenantScope("Lead", "deleteMany", undefined, COMPANY)).toEqual({
      where: { companyId: COMPANY },
    });
  });

  it("on upsert it scopes the where and stamps the company only on create", () => {
    const scoped = applyTenantScope(
      "Contact",
      "upsert",
      { where: { id: "c1" }, create: { firstName: "a" }, update: { firstName: "b" } },
      COMPANY,
    );
    expect(scoped).toEqual({
      where: { id: "c1", companyId: COMPANY },
      create: { firstName: "a", companyId: COMPANY },
      update: { firstName: "b" },
    });
  });

  it("does not inject companyId into models that inherit it through a relation", () => {
    const scoped = applyTenantScope(
      "QuoteItem",
      "create",
      { data: { description: "x", quoteId: "q1" } },
      COMPANY,
    ) as { data: AnyData };
    expect(scoped.data).not.toHaveProperty("companyId");
  });
});

type AnyData = Record<string, unknown>;

/**
 * Prisma demands a unique field at the top level of the `where` for these
 * operations. Wrapping it in an `AND` stops it counting as unique and the call
 * is rejected outright — which is what happened in production when someone
 * edited a quote.
 */
describe("applyTenantScope — the unique where Prisma requires", () => {
  const uniqueOps = ["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"];
  const listOps = ["findMany", "findFirst", "count", "updateMany", "deleteMany"];

  it.each(uniqueOps)("%s keeps the unique field at the top level", (operation) => {
    const scoped = applyTenantScope("Quote", operation, { where: { id: "q1" } }, COMPANY) as {
      where: Record<string, unknown>;
    };

    expect(scoped.where.id).toBe("q1");
    expect(scoped.where.companyId).toBe(COMPANY);
    expect(scoped.where.AND).toBeUndefined();
  });

  it.each(listOps)("%s may use AND, which never clashes with the caller", (operation) => {
    const scoped = applyTenantScope("Quote", operation, { where: { status: "SENT" } }, COMPANY) as {
      where: Record<string, unknown>;
    };

    expect(scoped.where.AND).toEqual([{ status: "SENT" }, { companyId: COMPANY }]);
  });

  it("a caller's companyId cannot win over the real one", () => {
    const scoped = applyTenantScope(
      "Quote",
      "update",
      { where: { id: "q1", companyId: OTHER }, data: {} },
      COMPANY,
    ) as { where: Record<string, unknown> };

    expect(scoped.where.companyId).toBe(COMPANY);
  });

  it("scopes a compound unique without losing it", () => {
    const scoped = applyTenantScope(
      "Quote",
      "update",
      { where: { companyId_number: { companyId: OTHER, number: 3 } }, data: {} },
      COMPANY,
    ) as { where: Record<string, unknown> };

    expect(scoped.where.companyId_number).toEqual({ companyId: OTHER, number: 3 });
    expect(scoped.where.companyId).toBe(COMPANY);
  });

  it("scopes a relation-owned model through its parent", () => {
    const scoped = applyTenantScope("QuoteSection", "update", { where: { id: "s1" } }, COMPANY);
    expect(scoped).toEqual({
      where: { id: "s1", quote: { is: { companyId: COMPANY } } },
    });
  });
});
