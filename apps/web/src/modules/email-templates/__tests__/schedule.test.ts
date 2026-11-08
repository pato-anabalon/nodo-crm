import { QuoteStatus } from "@/generated/prisma/enums";
import { shouldAskForReview, shouldFollowUp, type ScheduledQuote } from "../schedule";

const NOW = new Date("2026-09-23T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const inDays = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const waiting: ScheduledQuote = {
  status: QuoteStatus.SENT,
  sentAt: daysAgo(5),
  decidedAt: null,
  validUntil: inDays(20),
  shareRevokedAt: null,
  customerHasWritten: false,
  alreadySent: false,
};

describe("shouldFollowUp", () => {
  it("chases a quote nobody has answered once the wait is up", () => {
    expect(shouldFollowUp(waiting, 3, NOW)).toBe(true);
  });

  it("waits until the day arrives", () => {
    expect(shouldFollowUp(waiting, 7, NOW)).toBe(false);
    expect(shouldFollowUp({ ...waiting, sentAt: daysAgo(7) }, 7, NOW)).toBe(true);
  });

  /** The sweep sees the same quote every night; this is what makes it once. */
  it("never repeats one that already went", () => {
    expect(shouldFollowUp({ ...waiting, alreadySent: true }, 3, NOW)).toBe(false);
  });

  it.each([QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.DRAFT, QuoteStatus.EXPIRED])(
    "has nothing to chase on a %s quote",
    (status) => {
      expect(shouldFollowUp({ ...waiting, status }, 3, NOW)).toBe(false);
    },
  );

  /** Pressing about a price that no longer stands is worse than saying nothing. */
  it("stays quiet once the quote has run out", () => {
    expect(shouldFollowUp({ ...waiting, validUntil: daysAgo(1) }, 3, NOW)).toBe(false);
  });

  it("treats a quote with no end date as still standing", () => {
    expect(shouldFollowUp({ ...waiting, validUntil: null }, 3, NOW)).toBe(true);
  });

  /**
   * Somebody who replied "we're discussing it internally" and gets an automated
   * reminder two days later reads that nobody looked at their message.
   */
  it("stops once the customer has said something", () => {
    expect(shouldFollowUp({ ...waiting, customerHasWritten: true }, 3, NOW)).toBe(false);
  });

  /** Chasing with a link that no longer opens is a dead end with your name on it. */
  it("stops when the company closed the link", () => {
    expect(shouldFollowUp({ ...waiting, shareRevokedAt: daysAgo(1) }, 3, NOW)).toBe(false);
  });

  it("cannot chase a quote that was never sent", () => {
    expect(shouldFollowUp({ ...waiting, sentAt: null }, 3, NOW)).toBe(false);
  });
});

describe("shouldAskForReview", () => {
  const accepted: ScheduledQuote = {
    ...waiting,
    status: QuoteStatus.ACCEPTED,
    decidedAt: daysAgo(4),
  };

  it("asks once the wait since accepting is up", () => {
    expect(shouldAskForReview(accepted, 3, NOW)).toBe(true);
  });

  it("counts from the acceptance, not from the send", () => {
    // Sent long ago, accepted this morning: too early to ask.
    expect(
      shouldAskForReview({ ...accepted, sentAt: daysAgo(60), decidedAt: daysAgo(0) }, 3, NOW),
    ).toBe(false);
  });

  it.each([QuoteStatus.SENT, QuoteStatus.REJECTED, QuoteStatus.EXPIRED])(
    "has nobody to ask on a %s quote",
    (status) => {
      expect(shouldAskForReview({ ...accepted, status }, 3, NOW)).toBe(false);
    },
  );

  it("never asks twice", () => {
    expect(shouldAskForReview({ ...accepted, alreadySent: true }, 3, NOW)).toBe(false);
  });

  /** Somebody who accepted and then asked a question is exactly who to ask. */
  it("asks even if the customer has been writing", () => {
    expect(shouldAskForReview({ ...accepted, customerHasWritten: true }, 3, NOW)).toBe(true);
  });
});
