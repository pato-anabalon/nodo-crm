import { ActivityType } from "@/generated/prisma/enums";
import { describe as describeActivity } from "../lead-activity-log";

/** Stands in for next-intl: returns the key so the test can see what was asked. */
const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}(${JSON.stringify(values)})` : key;

const entry = (type: ActivityType, content: string) => ({ type, content });

describe("describe: a lead's status change", () => {
  it("translates both halves", () => {
    const out = describeActivity(entry(ActivityType.STATUS_CHANGE, "QUALIFIED>PROPOSAL"), t);
    expect(out).toContain("status.QUALIFIED");
    expect(out).toContain("status.PROPOSAL");
  });

  /**
   * The failure this guards against: history written with an arrow while the
   * reader split on ">", so the whole string became one half and the page asked
   * for `leads.status.QUALIFIED → PROPOSAL`. A line nobody can translate is
   * worth showing raw; it is never worth crashing over.
   */
  it("shows an unknown status as written instead of asking for a key", () => {
    const out = describeActivity(entry(ActivityType.STATUS_CHANGE, "QUALIFIED → PROPOSAL"), t);
    expect(out).toContain("QUALIFIED → PROPOSAL");
    expect(out).not.toContain("status.QUALIFIED → PROPOSAL");
  });

  it.each(["", ">", "SOMETHING_ELSE>LOST"])("survives %p", (content) => {
    expect(() => describeActivity(entry(ActivityType.STATUS_CHANGE, content), t)).not.toThrow();
  });

  it("never asks for a key built from a quote's status", () => {
    const out = describeActivity(entry(ActivityType.STATUS_CHANGE, "SENT>ACCEPTED"), t);
    expect(out).not.toContain("status.SENT");
    expect(out).toContain("SENT");
  });
});

describe("describe: a quote being answered", () => {
  it("reads as the quote it is, not as the lead's status", () => {
    const out = describeActivity(entry(ActivityType.QUOTE_DECIDED, "6>REJECTED"), t);
    expect(out).toContain("activity.QUOTE_DECIDED");
    expect(out).toContain("REJECTED");
    expect(out).toContain('"reference":"6"');
  });

  it("survives content it does not recognise", () => {
    expect(() => describeActivity(entry(ActivityType.QUOTE_DECIDED, ""), t)).not.toThrow();
  });
});
