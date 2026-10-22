// The service pulls in the notifier, which opens a database client on import.
jest.mock("@/modules/notifications/inbox", () => ({ notify: jest.fn() }));

import type { CompanyContext } from "@/lib/auth/session";
import { createLead, updateLead } from "../service";
import type { LeadFormValues } from "../schemas";

type Row = Record<string, unknown>;

/** Just enough of `ctx.db` for the lead, its contact and its company. */
function fakeCtx(seed: { contacts?: Row[]; clientCompanies?: Row[]; leads?: Row[] } = {}) {
  const contacts = [...(seed.contacts ?? [])];
  const clientCompanies = [...(seed.clientCompanies ?? [])];
  const leads = [...(seed.leads ?? [])];
  let next = 0;

  const db = {
    contact: {
      findFirst: async ({ where }: { where: Row }) =>
        contacts.find((c) => (where.id ? c.id === where.id : c.email === where.email)) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: `contact-${++next}`, ...data };
        contacts.push(row);
        return row;
      },
    },
    clientCompany: {
      findFirst: async ({ where }: { where: { name: { equals: string } } }) =>
        clientCompanies.find((c) => String(c.name).toLowerCase() === where.name.equals.toLowerCase()) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: `cc-${++next}`, ...data };
        clientCompanies.push(row);
        return row;
      },
    },
    lead: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `lead-${++next}`, ...data };
        leads.push(row);
        return row;
      },
      findFirst: async () => ({ id: "lead-0", status: "NEW", ownerId: "me" }),
      update: async ({ data }: { data: Row }) => ({ id: "lead-0", ...data }),
    },
    activity: { create: async () => ({}) },
  };

  const ctx = {
    user: { id: "me" },
    company: { id: "c1", currency: "NZD" },
    permissions: new Set(["leads.assign"]),
    db,
  } as unknown as CompanyContext;

  return { ctx, contacts, clientCompanies, leads };
}

const values = (over: Partial<LeadFormValues> = {}) =>
  ({ title: "Roof", status: "NEW", source: "OTHER", score: 0, ...over }) as LeadFormValues;

describe("a lead typed in by hand", () => {
  it("records the person as a contact, the way a web enquiry does", async () => {
    const { ctx, contacts, leads } = fakeCtx();
    await createLead(ctx, values({ contactName: "Paula Rivas", contactEmail: "Paula@Test.nz", contactPhone: "021" }));

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ companyId: "c1", firstName: "Paula", lastName: "Rivas", email: "paula@test.nz", phone: "021" });
    expect(leads[0].contactId).toBe(contacts[0].id);
  });

  it("links to the contact that already has that email instead of making a second", async () => {
    const { ctx, contacts, leads } = fakeCtx({ contacts: [{ id: "old", email: "paula@test.nz" }] });
    await createLead(ctx, values({ contactName: "Paula Rivas", contactEmail: "paula@test.nz" }));

    expect(contacts).toHaveLength(1);
    expect(leads[0].contactId).toBe("old");
  });

  it("files the contact under the company typed on the lead", async () => {
    const { ctx, contacts, clientCompanies, leads } = fakeCtx();
    await createLead(ctx, values({ contactName: "Paula Rivas", contactEmail: "p@test.nz", companyName: "Scott Builders" }));

    expect(clientCompanies).toHaveLength(1);
    expect(contacts[0].clientCompanyId).toBe(clientCompanies[0].id);
    expect(leads[0].clientCompanyId).toBe(clientCompanies[0].id);
  });

  it("makes no contact without an email, and keeps the details on the lead", async () => {
    const { ctx, contacts, leads } = fakeCtx();
    await createLead(ctx, values({ contactName: "Paula Rivas", contactPhone: "021" }));

    expect(contacts).toHaveLength(0);
    expect(leads[0]).toMatchObject({ contactId: null, contactName: "Paula Rivas", contactPhone: "021" });
  });

  it("uses the contact picked in the form and creates nobody", async () => {
    const { ctx, contacts, leads } = fakeCtx({ contacts: [{ id: "picked", email: "other@test.nz", clientCompanyId: "cc-9" }] });
    await createLead(ctx, values({ contactId: "picked", contactName: "Paula Rivas", contactEmail: "paula@test.nz" }));

    expect(contacts).toHaveLength(1);
    expect(leads[0]).toMatchObject({ contactId: "picked", clientCompanyId: "cc-9" });
  });

  it("does not turn a stale picked id into a new contact", async () => {
    const { ctx, contacts, leads } = fakeCtx();
    await createLead(ctx, values({ contactId: "gone", contactName: "Paula Rivas", contactEmail: "paula@test.nz" }));

    expect(contacts).toHaveLength(0);
    expect(leads[0].contactId).toBeNull();
  });

  it("does the same when an existing lead is saved with no contact", async () => {
    const { ctx, contacts } = fakeCtx();
    const lead = (await updateLead(ctx, "lead-0", values({ contactName: "Paula Rivas", contactEmail: "paula@test.nz" }))) as Row;

    expect(contacts).toHaveLength(1);
    expect(lead.contactId).toBe(contacts[0].id);
  });
});
