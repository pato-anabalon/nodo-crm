import { attachContact } from "../attach";

/** A stand-in for the transaction, recording what it was asked to do. */
function writer(existing: { id: string } | null = null) {
  const created: unknown[] = [];
  const looked: unknown[] = [];

  return {
    created,
    looked,
    contact: {
      async findFirst(args: never) {
        looked.push((args as { where: unknown }).where);
        return existing;
      },
      async create(args: never) {
        created.push((args as { data: unknown }).data);
        return { id: "new-contact" };
      },
    },
  };
}

const enquiry = {
  contactName: "Steve Scott",
  contactEmail: "Steve.Scott@Example.test",
  contactPhone: "021 555 0100",
};

describe("attachContact", () => {
  it("records a person the first time they enquire", async () => {
    const tx = writer(null);
    const id = await attachContact(tx as never, "cmp-1", enquiry);

    expect(id).toBe("new-contact");
    expect(tx.created).toEqual([
      {
        companyId: "cmp-1",
        firstName: "Steve",
        lastName: "Scott",
        email: "steve.scott@example.test",
        phone: "021 555 0100",
        clientCompanyId: null,
      },
    ]);
  });

  it("lands a returning customer on the record they already have", async () => {
    const tx = writer({ id: "existing-contact" });
    const id = await attachContact(tx as never, "cmp-1", enquiry);

    expect(id).toBe("existing-contact");
    expect(tx.created).toHaveLength(0);
  });

  it("matches on the address however it was capitalised", async () => {
    const tx = writer(null);
    await attachContact(tx as never, "cmp-1", enquiry);

    expect(tx.looked).toEqual([{ companyId: "cmp-1", email: "steve.scott@example.test" }]);
  });

  it("never looks outside the company", async () => {
    const tx = writer(null);
    await attachContact(tx as never, "cmp-2", enquiry);

    expect(tx.looked[0]).toHaveProperty("companyId", "cmp-2");
  });

  it("leaves a lead with no address alone", async () => {
    // Two "J. Smith" enquiries are not evidence of the same person; merging on a
    // name would put one customer's history on another's record.
    const tx = writer(null);
    const id = await attachContact(tx as never, "cmp-1", {
      contactName: "Steve Scott",
      contactEmail: null,
    });

    expect(id).toBeNull();
    expect(tx.created).toHaveLength(0);
    expect(tx.looked).toHaveLength(0);
  });

  it("leaves a lead with no name alone", async () => {
    const tx = writer(null);
    const id = await attachContact(tx as never, "cmp-1", {
      contactName: null,
      contactEmail: "s@e.test",
    });

    expect(id).toBeNull();
    expect(tx.created).toHaveLength(0);
  });

  it("stores a one-word name as a given name with no surname", async () => {
    const tx = writer(null);
    await attachContact(tx as never, "cmp-1", {
      contactName: "Steve",
      contactEmail: "s@e.test",
    });

    expect(tx.created[0]).toMatchObject({ firstName: "Steve", lastName: null });
  });
});

describe("attachContact and the customer's company", () => {
  it("hangs the new person off the company they enquired for", async () => {
    const tx = writer(null);
    await attachContact(tx as never, "cmp-1", enquiry, "client-co-1");

    expect(tx.created[0]).toMatchObject({ clientCompanyId: "client-co-1" });
  });

  it("leaves it empty when the form carried no company", async () => {
    const tx = writer(null);
    await attachContact(tx as never, "cmp-1", enquiry);

    expect(tx.created[0]).toMatchObject({ clientCompanyId: null });
  });
});
