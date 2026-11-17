import { LeadSource } from "@/generated/prisma/enums";
import { resolveIngestSource } from "../source";

const offered = ["Google Campaign", "Flyer"];

describe("resolveIngestSource", () => {
  it("is the website when the form doesn't say", () => {
    expect(resolveIngestSource(null, offered)).toEqual({ source: LeadSource.WEB, sourceDetail: null });
  });

  it.each([
    ["REFERRAL", LeadSource.REFERRAL],
    ["referral", LeadSource.REFERRAL],
    ["Cold call", LeadSource.COLD_CALL],
    ["COLD_CALL", LeadSource.COLD_CALL],
    ["Social media", LeadSource.SOCIAL],
    ["Website", LeadSource.WEB],
    ["Other", LeadSource.OTHER],
  ])("reads %p as one of the platform's own sources", (answer, source) => {
    expect(resolveIngestSource(answer, offered)).toEqual({ source, sourceDetail: null });
  });

  it("maps a label the company offers to Other with that detail, as the company wrote it", () => {
    expect(resolveIngestSource("google campaign", offered)).toEqual({
      source: LeadSource.OTHER,
      sourceDetail: "Google Campaign",
    });
    expect(resolveIngestSource("  FLYER ", offered)).toEqual({ source: LeadSource.OTHER, sourceDetail: "Flyer" });
  });

  it("prefers the platform's own source over a company label that spells the same", () => {
    expect(resolveIngestSource("Event", ["Event"])).toEqual({ source: LeadSource.EVENT, sourceDetail: null });
  });

  it("falls back to the website for an answer nobody offers, rather than storing it", () => {
    expect(resolveIngestSource("gogle", offered)).toEqual({ source: LeadSource.WEB, sourceDetail: null });
  });
});
