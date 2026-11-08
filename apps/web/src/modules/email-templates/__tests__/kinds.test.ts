import { EmailTemplateKind } from "@/generated/prisma/enums";
import { isEnabled, isOptional, TEMPLATE_ORDER, TEMPLATE_KINDS } from "../kinds";

describe("isEnabled", () => {
  /**
   * The decision that keeps the first sweep after release from chasing every
   * customer who already has an undecided quote sitting in their inbox.
   */
  it.each([
    EmailTemplateKind.FIRST_FOLLOW_UP,
    EmailTemplateKind.SECOND_FOLLOW_UP,
    EmailTemplateKind.REVIEW_REQUEST,
  ])("%s stays off until somebody asks for it", (kind) => {
    expect(isEnabled(kind, null)).toBe(false);
  });

  it("a confirmation to someone who just accepted is on from the start", () => {
    expect(isEnabled(EmailTemplateKind.QUOTE_ACCEPTED, null)).toBe(true);
  });

  /** Sending a quote *is* emailing the customer; there is nothing to turn off. */
  it("the quote email cannot be switched off, even by a stored row", () => {
    expect(isEnabled(EmailTemplateKind.NEW_QUOTE, null)).toBe(true);
    expect(isEnabled(EmailTemplateKind.NEW_QUOTE, { enabled: false })).toBe(true);
    expect(isOptional(EmailTemplateKind.NEW_QUOTE)).toBe(false);
  });

  it("a stored row wins over the default, in both directions", () => {
    expect(isEnabled(EmailTemplateKind.FIRST_FOLLOW_UP, { enabled: true })).toBe(true);
    expect(isEnabled(EmailTemplateKind.QUOTE_ACCEPTED, { enabled: false })).toBe(false);
  });
});

describe("the catalogue", () => {
  it("covers every kind in the enum, so none can be forgotten", () => {
    expect(Object.keys(TEMPLATE_KINDS).sort()).toEqual(Object.values(EmailTemplateKind).sort());
  });

  it("lists every kind exactly once for the screen", () => {
    expect([...TEMPLATE_ORDER].sort()).toEqual(Object.values(EmailTemplateKind).sort());
  });
});
