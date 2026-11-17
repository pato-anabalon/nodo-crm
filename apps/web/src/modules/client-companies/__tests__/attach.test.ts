import { attachClientCompany } from "../attach";

function writer(existing: { id: string } | null = null) {
  const created: unknown[] = [];
  const looked: unknown[] = [];
  return {
    created,
    looked,
    clientCompany: {
      async findFirst(args: never) {
        looked.push((args as { where: unknown }).where);
        return existing;
      },
      async create(args: never) {
        created.push((args as { data: unknown }).data);
        return { id: "new-company" };
      },
    },
  };
}

describe("attachClientCompany", () => {
  it("records a company the first time it appears", async () => {
    const tx = writer(null);
    const id = await attachClientCompany(tx as never, "cmp-1", "Scott Builders");

    expect(id).toBe("new-company");
    expect(tx.created).toEqual([{ companyId: "cmp-1", name: "Scott Builders" }]);
  });

  it("reuses the one already on record", async () => {
    const tx = writer({ id: "existing" });
    expect(await attachClientCompany(tx as never, "cmp-1", "scott builders")).toBe("existing");
    expect(tx.created).toHaveLength(0);
  });

  it("looks it up ignoring case and tidy-up", async () => {
    const tx = writer(null);
    await attachClientCompany(tx as never, "cmp-1", "  Scott   Builders ");

    expect(tx.looked).toEqual([
      { companyId: "cmp-1", name: { equals: "Scott Builders", mode: "insensitive" } },
    ]);
  });

  it("never looks outside the company", async () => {
    const tx = writer(null);
    await attachClientCompany(tx as never, "cmp-2", "Scott Builders");
    expect(tx.looked[0]).toHaveProperty("companyId", "cmp-2");
  });

  it.each([null, undefined, "", "   "])("invents nothing from %p", async (name) => {
    const tx = writer(null);
    expect(await attachClientCompany(tx as never, "cmp-1", name)).toBeNull();
    expect(tx.looked).toHaveLength(0);
    expect(tx.created).toHaveLength(0);
  });
});
