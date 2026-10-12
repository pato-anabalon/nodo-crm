import type { QuoteStatus } from "@/generated/prisma/enums";
import { shareStatus } from "@/modules/portal/share";
import type { ThreadMessage } from "@/modules/portal/thread";
import { isQuoteEditable } from "./constants";

/**
 * How often an open quote asks whether the customer is on it or has written.
 *
 * Presence and the thread used to be two polls, each every 10s, which is two
 * requests — and two session checks — every 10s for every quote somebody has
 * open. One feed answers both now (`/api/quotes/<id>/live`), and this decides
 * how often it is asked, if at all.
 *
 * 15s: a closed customer tab flips presence the instant it closes (see
 * `markLeft`), so the poll is all that stands between that write and somebody
 * on the team seeing it — a quarter of a minute is still well inside the time
 * it takes to pick up the phone, at two thirds of the requests 10s cost.
 */
export const LIVE_POLL_SECONDS = 15;

/**
 * A decided or run-out quote is still a conversation: the customer can write
 * as long as the link opens — somebody who accepted and then asked a question
 * is exactly who the team should hear from. Nobody is waiting on that reply to
 * the second, though, and "viewing now" has stopped being the moment to call.
 */
export const CLOSED_POLL_SECONDS = 60;

/**
 * `null` means don't ask at all: with the link revoked or expired the customer
 * can neither open the quote nor write on it, so there is nothing that could
 * change. The answer comes back on every poll, so a quote accepted or a link
 * revoked while the panel is open slows or stops it without a reload.
 */
export function livePollSeconds(
  status: QuoteStatus,
  share: { revokedAt: Date | null; expiresAt: Date | null } | null,
  now: Date = new Date(),
): number | null {
  if (shareStatus(share, now) !== "ok") return null;
  return isQuoteEditable(status) ? LIVE_POLL_SECONDS : CLOSED_POLL_SECONDS;
}

/** What one poll answers: both things that can change on an open quote, and
 * how long to wait before asking again. */
export type LiveFeed = {
  presence: {
    shared: boolean;
    viewingNow: boolean;
    openCount: number;
    lastSeenAt: string | null;
  };
  messages: ThreadMessage[];
  pollSeconds: number | null;
};
