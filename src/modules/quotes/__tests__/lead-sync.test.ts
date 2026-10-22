import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ActivityType, LeadStatus, QuoteStatus } from "@/generated/prisma/enums";
import { moveLeadAlong } from "../lead-sync";

function fakeDb(lead: LeadStatus | null, openQuotes = 0) {
  const activities: Array<{ userId: string | null; type: ActivityType; content: string }> = [];
  const updates: LeadStatus[] = [];
  const db = {
    quote: { count: async () => openQuotes },
    lead: {
      findFirst: async () => (lead ? { status: lead } : null),
      update: async (args: { data: { status: LeadStatus } }) => void updates.push(args.data.status),
    },
    activity: {
      create: async (args: { data: { userId: string | null; type: ActivityType; content: string } }) =>
        void activities.push(args.data),
    },
  };
  return { db, activities, updates };
}

const input = { companyId: "c1", leadId: "l1", userId: null };

describe("moveLeadAlong", () => {
  it("moves a lead in proposal to won when the quote is accepted, authored by nobody", async () => {
    const { db, activities, updates } = fakeDb(LeadStatus.PROPOSAL);
    await moveLeadAlong(db, { ...input, to: QuoteStatus.ACCEPTED });

    expect(updates).toEqual([LeadStatus.WON]);
    expect(activities).toEqual([
      { companyId: "c1", leadId: "l1", userId: null, type: ActivityType.STATUS_CHANGE, content: "PROPOSAL>WON" },
    ]);
  });

  it("loses the lead only when nothing is left open", async () => {
    const stillOpen = fakeDb(LeadStatus.PROPOSAL, 1);
    await moveLeadAlong(stillOpen.db, { ...input, to: QuoteStatus.REJECTED });
    expect(stillOpen.updates).toEqual([]);

    const nothingOpen = fakeDb(LeadStatus.PROPOSAL, 0);
    await moveLeadAlong(nothingOpen.db, { ...input, to: QuoteStatus.REJECTED });
    expect(nothingOpen.updates).toEqual([LeadStatus.LOST]);
  });

  it("leaves a won lead alone", async () => {
    const { db, updates, activities } = fakeDb(LeadStatus.WON);
    await moveLeadAlong(db, { ...input, to: QuoteStatus.ACCEPTED });
    expect(updates).toEqual([]);
    expect(activities).toEqual([]);
  });

  it("does nothing for a lead that isn't there", async () => {
    const { db, updates } = fakeDb(null);
    await moveLeadAlong(db, { ...input, to: QuoteStatus.ACCEPTED });
    expect(updates).toEqual([]);
  });
});

/**
 * The portal writes the quote directly, so nothing forces it to move the lead:
 * it didn't, and accepted quotes left their leads in PROPOSAL. Reading the
 * source is the only way to notice a decision path that forgot to.
 */
describe("every way a quote gets decided moves its lead", () => {
  const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

  it("the portal's accept and decline both settle the lead", () => {
    const source = read("src/modules/portal/actions.ts");
    expect(source).toContain("await settleLead(quote, QuoteStatus.ACCEPTED)");
    expect(source).toContain("await settleLead(share.quote, QuoteStatus.REJECTED)");
  });

  it.each(["src/modules/quotes/service.ts", "src/modules/quotes/sweep.ts"])("%s goes through moveLeadAlong", (file) => {
    expect(read(file)).toContain("moveLeadAlong(");
  });
});
