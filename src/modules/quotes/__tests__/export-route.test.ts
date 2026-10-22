/** @jest-environment node */
const getCompanyContext = jest.fn();
const exportQuoteBatches = jest.fn();

jest.mock("@/lib/auth/session", () => ({ getCompanyContext: () => getCompanyContext() }));
jest.mock("@/modules/quotes/export-service", () => ({
  exportQuoteBatches: (...args: unknown[]) => exportQuoteBatches(...args),
}));
jest.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

import { GET } from "@/app/api/quotes/export/route";
import { yearOf } from "../export";

const thisYear = yearOf(new Date(), "Pacific/Auckland");

function ctx(permissions: string[]) {
  return { company: { slug: "acme", quotePrefix: "NQ", timezone: "Pacific/Auckland" }, permissions: new Set(permissions) };
}

async function* batches(...rows: Record<string, unknown>[][]) {
  for (const batch of rows) yield batch;
}

const quote = {
  number: 3, title: "Roof", status: "SENT", clientName: "Paula", clientCompanyName: null, clientEmail: null,
  clientPhone: null, createdAt: new Date("2025-06-01T00:00:00Z"), sentAt: null, decidedAt: null, validUntil: null,
  currency: "NZD", share: { openCount: 1 }, subtotal: "100", discount: "0", taxAmount: "15", taxDisplayMode: "TAX_EXCLUSIVE", total: "115",
};

const call = (query = `year=${thisYear}`) => GET(new Request(`http://acme.localhost/api/quotes/export?${query}`));

beforeEach(() => {
  getCompanyContext.mockReset();
  exportQuoteBatches.mockReset();
  exportQuoteBatches.mockImplementation(() => batches([quote]));
});

describe("GET /api/quotes/export", () => {
  it("turns away somebody who isn't signed in", async () => {
    getCompanyContext.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("turns away a profile without the export permission, reading nothing", async () => {
    getCompanyContext.mockResolvedValue(ctx(["quotes.read", "quotes.read.all", "quotes.read.amounts"]));
    expect((await call()).status).toBe(403);
    expect(exportQuoteBatches).not.toHaveBeenCalled();
  });

  it("needs to be able to read quotes as well", async () => {
    getCompanyContext.mockResolvedValue(ctx(["quotes.export"]));
    expect((await call()).status).toBe(403);
  });

  it.each([["no year", ""], ["not a year", "year=all"], ["two digits", "year=25"], ["too early", "year=1999"], ["in the future", `year=${thisYear + 1}`]])(
    "refuses a request with %s: there is no 'all'",
    async (_label, query) => {
      getCompanyContext.mockResolvedValue(ctx(["quotes.read", "quotes.export"]));
      expect((await call(query)).status).toBe(400);
      expect(exportQuoteBatches).not.toHaveBeenCalled();
    },
  );

  it("sends a CSV download named for the company and the year, never cached", async () => {
    getCompanyContext.mockResolvedValue(ctx(["quotes.read", "quotes.export", "quotes.read.amounts"]));
    const response = await call("year=2025");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="acme-quotes-2025.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(exportQuoteBatches).toHaveBeenCalledWith(expect.anything(), 2025, true);
  });

  it("includes the amount columns, and the figures, only for a profile that can see them", async () => {
    getCompanyContext.mockResolvedValue(ctx(["quotes.read", "quotes.export", "quotes.read.amounts"]));
    const response = await call();
    // `text()` drops a leading BOM by spec, so the bytes are read as they are.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const withAmounts = new TextDecoder().decode(bytes);
    expect(withAmounts).toContain("quotes.export.columns.total");
    expect(withAmounts).toContain("115.00");

    exportQuoteBatches.mockImplementation(() => batches([quote]));
    getCompanyContext.mockResolvedValue(ctx(["quotes.read", "quotes.export"]));
    const without = await (await call()).text();
    expect(exportQuoteBatches).toHaveBeenLastCalledWith(expect.anything(), thisYear, false);
    for (const column of ["total", "subtotal", "discount", "tax", "taxMode", "currency"]) {
      expect(without).not.toContain(`quotes.export.columns.${column}`);
    }
    // Even if a row somehow carried the figures, the file has no column for them.
    expect(without).not.toContain("115.00");
    expect(without).toContain("NQ-000003");
  });

  it("echoes the page's token in a cookie so it can tell the download started", async () => {
    getCompanyContext.mockResolvedValue(ctx(["quotes.read", "quotes.export"]));
    const ok = await call(`year=${thisYear}&token=abc12345-def`);
    expect(ok.headers.get("Set-Cookie")).toContain("quotes_export_started=abc12345-def");

    // A token that isn't plain characters is not written into a header.
    const bad = await call(`year=${thisYear}&token=${encodeURIComponent("x; Path=/evil")}`);
    expect(bad.headers.get("Set-Cookie")).toBeNull();
    expect((await call()).headers.get("Set-Cookie")).toBeNull();
  });

  it("writes the header alone for a year with nothing in it", async () => {
    getCompanyContext.mockResolvedValue(ctx(["quotes.read", "quotes.export"]));
    exportQuoteBatches.mockImplementation(() => batches());
    const text = await (await call()).text();
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(1);
  });
});
