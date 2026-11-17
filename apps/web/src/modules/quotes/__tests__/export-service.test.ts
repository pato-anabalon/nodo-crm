const quoteFindFirst = jest.fn();
const forCompany = jest.fn();

// A cache that remembers nothing: what is under test is the query and the
// merge, and Next's cache isn't available outside a request anyway.
jest.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock("@/lib/db/tenant", () => ({ forCompany: (...args: unknown[]) => forCompany(...args) }));
jest.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import type { CompanyContext } from "@/lib/auth/session";
import { EXPORT_BATCH_SIZE, exportQuoteBatches, quoteYears } from "../export-service";
import { yearOf } from "../export";

const TZ = "Pacific/Auckland";
const thisYear = yearOf(new Date(), TZ);

function ctxWith(permissions: string[], currentYearHasQuotes: boolean, findMany = jest.fn()) {
  return {
    user: { id: "me" },
    company: { id: "c1", timezone: TZ },
    permissions: new Set(permissions),
    db: {
      quote: {
        findFirst: jest.fn().mockResolvedValue(currentYearHasQuotes ? { id: "q" } : null),
        findMany,
      },
    },
  } as unknown as CompanyContext;
}

/** A tenant client whose quotes exist in exactly the given years. */
function tenantWithYears(years: number[]) {
  quoteFindFirst.mockImplementation(async ({ where, orderBy }: { where: { createdAt: { gte?: Date; lt: Date } }; orderBy?: { createdAt: string } }) => {
    const matches = years
      .map((year) => ({ year, at: new Date(Date.UTC(year, 5, 1)) }))
      .filter(({ at }) => (!where.createdAt.gte || at >= where.createdAt.gte) && at < where.createdAt.lt);
    if (matches.length === 0) return null;
    const sorted = orderBy?.createdAt === "desc" ? matches.reverse() : matches;
    return { id: "q", createdAt: sorted[0].at };
  });
  forCompany.mockReturnValue({ quote: { findFirst: quoteFindFirst } });
}

beforeEach(() => {
  quoteFindFirst.mockReset();
  forCompany.mockReset();
});

describe("quoteYears", () => {
  it("lists the past years that have quotes, skipping empty ones in between, most recent first", async () => {
    tenantWithYears([2021, 2023, 2024]);
    const years = await quoteYears(ctxWith(["quotes.read.all"], true));
    expect(years).toEqual([thisYear, 2024, 2023, 2021]);
  });

  it("offers the current year only when there is something in it", async () => {
    tenantWithYears([2023]);
    expect(await quoteYears(ctxWith(["quotes.read.all"], false))).toEqual([2023]);
  });

  it("is empty for a company with no quotes", async () => {
    tenantWithYears([]);
    expect(await quoteYears(ctxWith(["quotes.read.all"], false))).toEqual([]);
  });

  it("asks the cache about everybody's quotes for a profile that sees all, and only the person's own otherwise", async () => {
    tenantWithYears([2023]);
    await quoteYears(ctxWith(["quotes.read.all"], false));
    expect(quoteFindFirst.mock.calls[0][0].where).not.toHaveProperty("createdById");

    quoteFindFirst.mockClear();
    tenantWithYears([2023]);
    await quoteYears(ctxWith(["quotes.read"], false));
    expect(quoteFindFirst.mock.calls[0][0].where.createdById).toBe("me");
  });

  it("goes through the tenant client, for the company in the session", async () => {
    tenantWithYears([2023]);
    await quoteYears(ctxWith(["quotes.read.all"], false));
    expect(forCompany).toHaveBeenCalledWith("c1");
  });
});

describe("exportQuoteBatches", () => {
  const rows = (from: number, count: number) =>
    Array.from({ length: count }, (_, index) => ({ number: from + index }));

  async function collect(generator: AsyncGenerator<unknown[]>) {
    const batches: unknown[][] = [];
    for await (const batch of generator) batches.push(batch);
    return batches;
  }

  it("pages by quote number and stops at the first short batch", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(rows(1, EXPORT_BATCH_SIZE))
      .mockResolvedValueOnce(rows(EXPORT_BATCH_SIZE + 1, 10));

    const batches = await collect(exportQuoteBatches(ctxWith(["quotes.read.all"], false, findMany), 2025, true));

    expect(batches.map((batch) => batch.length)).toEqual([EXPORT_BATCH_SIZE, 10]);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0][0].where.number).toEqual({ gt: 0 });
    expect(findMany.mock.calls[1][0].where.number).toEqual({ gt: EXPORT_BATCH_SIZE });
  });

  it("reads nothing past an empty year", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    expect(await collect(exportQuoteBatches(ctxWith(["quotes.read.all"], false, findMany), 2025, true))).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("limits the read to one year and to what the profile may open", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await collect(exportQuoteBatches(ctxWith(["quotes.read"], false, findMany), 2025, true));
    const where = findMany.mock.calls[0][0].where;
    expect(where.createdById).toBe("me");
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lt).toBeInstanceOf(Date);
  });

  it("doesn't even select the amounts for a profile that can't see them", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await collect(exportQuoteBatches(ctxWith(["quotes.read.all"], false, findMany), 2025, false));
    const select = findMany.mock.calls[0][0].select;
    for (const field of ["total", "subtotal", "discount", "taxAmount"]) expect(select).not.toHaveProperty(field);

    findMany.mockClear();
    await collect(exportQuoteBatches(ctxWith(["quotes.read.all"], false, findMany), 2025, true));
    expect(findMany.mock.calls[0][0].select.total).toBe(true);
  });
});
