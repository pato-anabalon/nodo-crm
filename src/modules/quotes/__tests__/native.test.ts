import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isNativeQuote, nativeQuoteWhere } from "../native";

describe("isNativeQuote", () => {
  it("counts the start itself as made here, and anything below it as brought in", () => {
    expect(isNativeQuote(3000, 3000)).toBe(true);
    expect(isNativeQuote(2999, 3000)).toBe(false);
    expect(isNativeQuote(3001, 3000)).toBe(true);
  });

  it("leaves a company that never migrated untouched: its start is 1 and every quote counts", () => {
    expect(isNativeQuote(1, 1)).toBe(true);
    expect(isNativeQuote(500, 1)).toBe(true);
  });

  it("is the same rule as the Prisma filter", () => {
    expect(nativeQuoteWhere(3000)).toEqual({ number: { gte: 3000 } });
  });
});

/**
 * The rule only protects anything if every automatic pass over quotes applies
 * it, and a fourth pass added later is exactly how one gets forgotten. The
 * sweeps need a database, so this reads their source instead: every query on
 * `prisma.quote` in them must spread `nativeQuoteWhere`.
 */
describe("the nightly sweep and quotes brought in from another tool", () => {
  const SWEEPS = [
    "src/modules/email-templates/sweep.ts",
    "src/modules/quotes/sweep.ts",
    "src/modules/notifications/sweep.ts",
  ];

  it.each(SWEEPS)("%s filters every quote query through nativeQuoteWhere", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const queries = [...source.matchAll(/prisma\.quote\.(findMany|findFirst|count|updateMany)\(/g)];

    for (const query of queries) {
      // The `where` that follows the call, up to the next call or the end.
      const rest = source.slice(query.index);
      const end = rest.indexOf("prisma.", 10);
      const block = end === -1 ? rest : rest.slice(0, end);
      // The count of still-open quotes on one lead (in `closeExpiredQuotes`) is
      // about a lead's other quotes, not about choosing what to act on.
      if (/leadId: quote\.leadId/.test(block)) continue;
      expect(block).toContain("nativeQuoteWhere(");
    }
  });

  it("is applied in at least one query per sweep that acts on quotes", () => {
    for (const file of SWEEPS) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).toContain("nativeQuoteWhere(");
    }
  });
});
