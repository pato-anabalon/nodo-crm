/**
 * Whether the customer can be emailed about a change to their quote now.
 * Pure, so the page that offers the tick and the action that acts on it give
 * the same answer.
 *
 * - **Never opened**: nothing to say — when they open it they see the current
 *   version, and an email about a change to something they haven't read is
 *   noise.
 * - **The link is shut** (revoked, or the quote ran out): an email would hand
 *   out a link, and issuing one reopens a revoked share.
 * - **Told recently**: at most one such email per quote every
 *   `CUSTOMER_NOTICE_EVERY_MS`, so a morning of corrections is one email; the
 *   history still keeps every change, and the page they have open still says so.
 */
export const CUSTOMER_NOTICE_EVERY_MS = 12 * 60 * 60_000;

export type CustomerNotice =
  | { kind: "ready" }
  | { kind: "unopened" }
  | { kind: "closed" }
  | { kind: "waiting"; until: Date };

export function customerNotice(input: {
  share: { openCount: number; revokedAt: Date | null } | null;
  ranOut: boolean;
  lastSentAt: Date | null;
  now: Date;
}): CustomerNotice {
  if (!input.share || input.share.revokedAt || input.ranOut) return { kind: "closed" };
  if (input.share.openCount === 0) return { kind: "unopened" };
  if (input.lastSentAt) {
    const until = new Date(input.lastSentAt.getTime() + CUSTOMER_NOTICE_EVERY_MS);
    if (until > input.now) return { kind: "waiting", until };
  }
  return { kind: "ready" };
}
