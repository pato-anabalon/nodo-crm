import { createHash, randomBytes } from "node:crypto";

/**
 * The link the customer opens their quote with.
 *
 * Only the hash is stored: the full token lives solely in the URL they're sent.
 * Whoever holds the link can view and answer that quote and no other, so the
 * token is long and random, not derived from anything guessable.
 */

/** 32 bytes: guessing it is infeasible even knowing the format. */
export function generateShareToken(): { token: string; hashedToken: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hashedToken: hashShareToken(token) };
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Window after which the customer is considered to have stopped looking. */
export const PRESENCE_WINDOW_SECONDS = 45;

/** How often the customer's page beats. Must be shorter than the window. */
export const HEARTBEAT_SECONDS = 20;

/**
 * Is the customer looking at the quote right now?
 *
 * Periodic polling from the panel is enough: no real-time infrastructure is
 * needed to answer this question. `viewing` is the customer's own tab saying
 * so — set on every heartbeat, and cleared the moment it says it's leaving —
 * and the window is what stops a tab that vanished without saying anything
 * (a crash, a killed process) from reading as watched forever.
 */
export function isViewingNow(
  share: { viewing: boolean; lastSeenAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (!share.viewing || !share.lastSeenAt) return false;
  const elapsed = now.getTime() - share.lastSeenAt.getTime();
  return elapsed >= 0 && elapsed <= PRESENCE_WINDOW_SECONDS * 1000;
}

export type ShareStatus = "ok" | "not-found" | "revoked" | "expired";

export function shareStatus(
  share: { revokedAt: Date | null; expiresAt: Date | null } | null,
  now: Date = new Date(),
): ShareStatus {
  if (!share) return "not-found";
  if (share.revokedAt) return "revoked";
  if (share.expiresAt && share.expiresAt.getTime() < now.getTime()) return "expired";
  return "ok";
}

/** The URL sent to the customer. It lives on their supplier's subdomain. */
export function shareUrl(slug: string, token: string, rootDomain: string): string {
  const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${rootDomain}/q/${token}`;
}
