import {
  wasAwaitingAt,
  wasDecidedWithin,
  wasExpiredWithin,
  wasSentWithin,
  type QuoteLike,
} from "../stock-flow";
import type { Range } from "../service";

const period: Range = {
  from: new Date("2023-01-01T00:00:00Z"),
  to: new Date("2024-01-01T00:00:00Z"),
};

const day = (iso: string) => new Date(iso);

function quote(partial: Partial<QuoteLike>): QuoteLike {
  return { sentAt: null, decidedAt: null, validUntil: null, status: "SENT", ...partial };
}

/**
 * The identity the Reports cards are supposed to satisfy:
 *
 *   awaiting(start) + sent(period) = decided(period) + expired(period) + awaiting(end)
 *
 * Checked the honest way — not by subtracting totals, which can hide one
 * quote cancelling another out, but by classifying every quote on its own
 * and requiring exactly one outcome. `sent` quotes that were also open at
 * the start are impossible (sent-before-start and sent-within-period are
 * mutually exclusive), so there's nothing to double-count on the way in.
 */
function classify(q: QuoteLike) {
  const openedPool = wasAwaitingAt(q, period.from) || wasSentWithin(q, period);
  if (!openedPool) return null;

  return {
    decided: wasDecidedWithin(q, period),
    expired: wasExpiredWithin(q, period),
    stillAwaiting: wasAwaitingAt(q, period.to),
  };
}

describe("the stock/flow partition behind the Reports cards", () => {
  it("leaves a never-touched quote awaiting at both ends", () => {
    const q = quote({ sentAt: day("2022-06-01T00:00:00Z") });
    const outcome = classify(q);
    expect(outcome).toEqual({ decided: false, expired: false, stillAwaiting: true });
  });

  it("takes a quote decided inside the period out of the stock", () => {
    const q = quote({
      sentAt: day("2022-11-01T00:00:00Z"),
      decidedAt: day("2023-06-01T00:00:00Z"),
      status: "ACCEPTED",
    });
    expect(classify(q)).toEqual({ decided: true, expired: false, stillAwaiting: false });
  });

  it("takes a quote expired inside the period out of the stock, with no decidedAt to key on", () => {
    const q = quote({
      sentAt: day("2022-11-01T00:00:00Z"),
      validUntil: day("2023-03-01T00:00:00Z"),
      status: "EXPIRED",
    });
    expect(classify(q)).toEqual({ decided: false, expired: true, stillAwaiting: false });
  });

  it("is the bug this module exists to catch: an expired quote must not also read as awaiting", () => {
    // Before `expired` existed, `awaiting` had no status filter: this quote
    // had `decidedAt: null` like any open one, and piled up forever.
    const q = quote({
      sentAt: day("2017-01-01T00:00:00Z"),
      validUntil: day("2017-02-01T00:00:00Z"),
      status: "EXPIRED",
    });
    expect(wasAwaitingAt(q, period.to)).toBe(false);
  });

  it("counts a quote sent and decided within the same period without it ever being 'awaiting'", () => {
    const q = quote({
      sentAt: day("2023-03-01T00:00:00Z"),
      decidedAt: day("2023-03-15T00:00:00Z"),
      status: "REJECTED",
    });
    expect(wasAwaitingAt(q, period.from)).toBe(false); // not sent yet at the period's start
    expect(classify(q)).toEqual({ decided: true, expired: false, stillAwaiting: false });
  });

  it("keeps a quote open at the close when it's decided after the period ends", () => {
    // Still counts toward *this* period's awaiting stock — it really was
    // open at the close — even though it won't appear in next period's
    // `decided` figure until `decidedAt` actually falls inside it.
    const q = quote({
      sentAt: day("2023-10-01T00:00:00Z"),
      decidedAt: day("2024-02-01T00:00:00Z"),
      status: "ACCEPTED",
    });
    expect(classify(q)).toEqual({ decided: false, expired: false, stillAwaiting: true });
  });

  it("keeps a quote open at the close when its validity only runs out afterwards", () => {
    const q = quote({
      sentAt: day("2023-12-20T00:00:00Z"),
      validUntil: day("2024-01-20T00:00:00Z"),
      status: "EXPIRED", // dead by today, but not yet as of this period's close
    });
    expect(classify(q)).toEqual({ decided: false, expired: false, stillAwaiting: true });
  });

  it("treats the period's own boundary as half-open, like the Prisma `where` it mirrors", () => {
    const sentExactlyAtStart = quote({ sentAt: period.from });
    expect(wasSentWithin(sentExactlyAtStart, period)).toBe(true);
    expect(wasAwaitingAt(sentExactlyAtStart, period.from)).toBe(false); // not yet sent *before* the start

    const decidedExactlyAtEnd = quote({
      sentAt: day("2023-06-01T00:00:00Z"),
      decidedAt: period.to,
      status: "ACCEPTED",
    });
    // `decidedAt: { lt: period.to }` excludes it from this period's `decided`...
    expect(wasDecidedWithin(decidedExactlyAtEnd, period)).toBe(false);
    // ...and `decidedAt: { gte: period.to }` is exactly what keeps it `awaiting`.
    expect(wasAwaitingAt(decidedExactlyAtEnd, period.to)).toBe(true);
  });

  it("ignores a quote that hasn't been sent yet", () => {
    const q = quote({ status: "DRAFT" });
    expect(classify(q)).toBeNull();
  });

  /**
   * The systematic sweep: every realistic lifecycle, at every date relative
   * to the period, gets exactly one outcome — never zero, never two. Hand
   * cases above pin the reasoning; this is what would have caught the
   * original bug (and the off-by-one a quick manual check produced) without
   * anyone having to think of it by name.
   */
  it("classifies every combination into exactly one outcome, with nothing left over and nothing double-counted", () => {
    const before = day("2022-06-01T00:00:00Z");
    const early = day("2023-02-01T00:00:00Z");
    const late = day("2023-11-01T00:00:00Z");
    const after = day("2024-06-01T00:00:00Z");
    const sentDates = [before, early, late, after];
    const relativeDates = [null, before, early, late, after, period.from, period.to];

    const quotes: QuoteLike[] = [];

    for (const sentAt of sentDates) {
      // Still open: never decided, maybe no expiry set, maybe one that hasn't
      // arrived yet.
      for (const validUntil of relativeDates) {
        if (validUntil !== null && validUntil <= sentAt) continue; // can't expire before it's sent
        quotes.push(quote({ sentAt, status: "SENT", validUntil }));
      }

      // Decided, at every point relative to the period.
      for (const decidedAt of relativeDates) {
        if (decidedAt === null || decidedAt < sentAt) continue;
        quotes.push(quote({ sentAt, decidedAt, status: "ACCEPTED" }));
        quotes.push(quote({ sentAt, decidedAt, status: "REJECTED" }));
      }

      // Expired, at every point relative to the period.
      for (const validUntil of relativeDates) {
        if (validUntil === null || validUntil < sentAt) continue;
        quotes.push(quote({ sentAt, validUntil, status: "EXPIRED" }));
      }
    }

    let checked = 0;
    for (const q of quotes) {
      const outcome = classify(q);
      if (outcome === null) continue; // correctly outside the period's pool
      checked += 1;

      const count = Number(outcome.decided) + Number(outcome.expired) + Number(outcome.stillAwaiting);
      if (count !== 1) {
        throw new Error(
          `Quote ${JSON.stringify(q)} resolved to ${count} outcomes instead of 1: ${JSON.stringify(outcome)}`,
        );
      }
    }

    // A sanity floor, so a change that made every quote fall outside the
    // pool (and the loop above a no-op) still fails loudly.
    expect(checked).toBeGreaterThan(20);
  });
});
