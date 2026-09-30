import { QuoteStatus } from "@/generated/prisma/enums";
import {
  QUOTE_SECTIONS,
  QUOTE_STATUSES,
  canTransition,
  isQuoteEditable,
  isQuoteSection,
  sectionStatuses,
} from "../constants";

describe("isQuoteEditable", () => {
  it("allows editing a draft and a quote still awaiting an answer", () => {
    expect(isQuoteEditable(QuoteStatus.DRAFT)).toBe(true);
    expect(isQuoteEditable(QuoteStatus.SENT)).toBe(true);
  });

  it("locks a quote once the customer has answered, or it ran out", () => {
    for (const status of [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED]) {
      expect(isQuoteEditable(status)).toBe(false);
    }
  });
});

describe("canTransition", () => {
  it("allows sending a draft", () => {
    expect(canTransition(QuoteStatus.DRAFT, QuoteStatus.SENT)).toBe(true);
  });

  it("allows deciding a sent quote", () => {
    expect(canTransition(QuoteStatus.SENT, QuoteStatus.ACCEPTED)).toBe(true);
    expect(canTransition(QuoteStatus.SENT, QuoteStatus.REJECTED)).toBe(true);
  });

  it("does not allow going back from an already decided status", () => {
    expect(canTransition(QuoteStatus.ACCEPTED, QuoteStatus.DRAFT)).toBe(false);
    expect(canTransition(QuoteStatus.ACCEPTED, QuoteStatus.SENT)).toBe(false);
    expect(canTransition(QuoteStatus.REJECTED, QuoteStatus.ACCEPTED)).toBe(false);
  });

  it("does not allow skipping the send", () => {
    expect(canTransition(QuoteStatus.DRAFT, QuoteStatus.ACCEPTED)).toBe(false);
  });

  it("allows resending an expired quote", () => {
    expect(canTransition(QuoteStatus.EXPIRED, QuoteStatus.SENT)).toBe(true);
  });
});

describe("QUOTE_STATUSES", () => {
  it("lists every status from the enum, without repeats", () => {
    expect([...QUOTE_STATUSES].sort()).toEqual(Object.values(QuoteStatus).sort());
  });
});

describe("panel sections", () => {
  it('"all" does not scope by status', () => {
    expect(sectionStatuses("all")).toBeNull();
  });

  it('"waiting" means sent without an answer', () => {
    expect(sectionStatuses("waiting")).toEqual([QuoteStatus.SENT]);
  });

  it('"active" includes sent and accepted', () => {
    expect(sectionStatuses("active")).toEqual([QuoteStatus.SENT, QuoteStatus.ACCEPTED]);
  });

  it('"closed" excludes drafts and does not leave out expired ones', () => {
    const closed = sectionStatuses("closed") ?? [];
    expect(closed).toContain(QuoteStatus.EXPIRED);
    expect(closed).not.toContain(QuoteStatus.DRAFT);
  });

  it("every status appears in some section", () => {
    const covered = new Set(
      QUOTE_SECTIONS.flatMap((section) => sectionStatuses(section) ?? []),
    );
    for (const status of Object.values(QuoteStatus)) {
      expect(covered.has(status)).toBe(true);
    }
  });

  it("isQuoteSection rejects invented values", () => {
    expect(isQuoteSection("waiting")).toBe(true);
    expect(isQuoteSection("inventada")).toBe(false);
    expect(isQuoteSection(undefined)).toBe(false);
  });
});
