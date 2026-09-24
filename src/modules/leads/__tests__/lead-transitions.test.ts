import { LeadStatus } from "@/generated/prisma/enums";
import { nextLeadStatus } from "../constants";

describe("nextLeadStatus — a quote goes out", () => {
  it.each([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED])(
    "moves %s along to proposal",
    (from) => {
      expect(nextLeadStatus(from, "quote-sent")).toBe(LeadStatus.PROPOSAL);
    },
  );

  it("leaves a lead already in proposal alone", () => {
    expect(nextLeadStatus(LeadStatus.PROPOSAL, "quote-sent")).toBeNull();
  });

  it("does not drag a lead in negotiation back to proposal", () => {
    // A revised quote going out is progress, not a step backwards.
    expect(nextLeadStatus(LeadStatus.NEGOTIATION, "quote-sent")).toBeNull();
  });

  it("revives a lost lead", () => {
    expect(nextLeadStatus(LeadStatus.LOST, "quote-sent")).toBe(LeadStatus.PROPOSAL);
  });

  it("never reopens a won lead", () => {
    // The customer coming back is a new lead; this one's history stands.
    expect(nextLeadStatus(LeadStatus.WON, "quote-sent")).toBeNull();
  });
});

describe("nextLeadStatus — the customer accepts", () => {
  it.each([LeadStatus.NEW, LeadStatus.PROPOSAL, LeadStatus.NEGOTIATION, LeadStatus.LOST])(
    "wins from %s",
    (from) => {
      expect(nextLeadStatus(from, "quote-accepted")).toBe(LeadStatus.WON);
    },
  );

  it("has nothing to do when it was already won", () => {
    expect(nextLeadStatus(LeadStatus.WON, "quote-accepted")).toBeNull();
  });
});

describe("nextLeadStatus — every quote was turned down", () => {
  it("loses the lead", () => {
    expect(nextLeadStatus(LeadStatus.PROPOSAL, "quotes-all-declined")).toBe(LeadStatus.LOST);
  });

  it("says nothing when it was already lost", () => {
    expect(nextLeadStatus(LeadStatus.LOST, "quotes-all-declined")).toBeNull();
  });

  it("does not take a win away", () => {
    // One quote of several being declined can't undo an acceptance.
    expect(nextLeadStatus(LeadStatus.WON, "quotes-all-declined")).toBeNull();
  });
});
