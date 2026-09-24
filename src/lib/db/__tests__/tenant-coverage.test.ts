import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIRECT_TENANT_MODELS,
  GLOBAL_MODELS,
  RELATION_TENANT_MODELS,
} from "../tenant-scope";

/**
 * Reads the Prisma schema and demands that every model be classified.
 *
 * This test exists because of a real leak: ten models were added to the schema
 * over time and none of them reached the scoping list, so one company could read
 * another's reviews and ingest keys. Reviewing a list by hand doesn't catch that;
 * comparing it against the schema does.
 */
const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

function models(): Array<{ name: string; body: string }> {
  return [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map((m) => ({
    name: m[1],
    body: m[2],
  }));
}

const all = models();

describe("tenant scoping covers the schema", () => {
  it("finds the models in the schema at all", () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it("classifies every model as scoped, relation-scoped or global", () => {
    const unclassified = all
      .map((m) => m.name)
      .filter(
        (name) =>
          !DIRECT_TENANT_MODELS.has(name) &&
          !(name in RELATION_TENANT_MODELS) &&
          !GLOBAL_MODELS.has(name),
      );

    expect(unclassified).toEqual([]);
  });

  it("scopes every model that carries a companyId", () => {
    const withCompanyId = all
      .filter((m) => /^\s+companyId\s/m.test(m.body))
      .map((m) => m.name);

    const unscoped = withCompanyId.filter((name) => !DIRECT_TENANT_MODELS.has(name));
    expect(unscoped).toEqual([]);
  });

  it("does not claim a model carries a companyId when it doesn't", () => {
    const wrong = [...DIRECT_TENANT_MODELS].filter((name) => {
      const model = all.find((m) => m.name === name);
      return model ? !/^\s+companyId\s/m.test(model.body) : true;
    });

    expect(wrong).toEqual([]);
  });

  it("points each relation-scoped model at a relation it actually has", () => {
    const broken = Object.entries(RELATION_TENANT_MODELS).filter(([name, relation]) => {
      const model = all.find((m) => m.name === name);
      return model ? !new RegExp(`^\\s+${relation}\\s+\\w+`, "m").test(model.body) : true;
    });

    expect(broken).toEqual([]);
  });

  it("keeps nothing in two categories at once", () => {
    const direct = [...DIRECT_TENANT_MODELS];
    expect(direct.filter((n) => n in RELATION_TENANT_MODELS)).toEqual([]);
    expect(direct.filter((n) => GLOBAL_MODELS.has(n))).toEqual([]);
    expect(Object.keys(RELATION_TENANT_MODELS).filter((n) => GLOBAL_MODELS.has(n))).toEqual([]);
  });

  it("treats as global only what genuinely belongs to no company", () => {
    // If one of these ever gains a companyId it stops being global, and the
    // absence of scoping becomes a leak.
    for (const name of GLOBAL_MODELS) {
      const model = all.find((m) => m.name === name);
      if (!model) continue;
      expect({ name, hasCompanyId: /^\s+companyId\s/m.test(model.body) }).toEqual({
        name,
        hasCompanyId: false,
      });
    }
  });
});
