import { createHash, randomBytes } from "node:crypto";
import { InvitationStatus } from "@/generated/prisma/enums";

/**
 * The link that lets somebody join a company.
 *
 * Only the hash is stored, for the same reason as quote links and ingest keys:
 * whoever holds the token can join, and a database dump must not be enough to
 * do that. The consequence is the same too — an issued invitation can never be
 * read back, so resending means minting a new link and killing the old one.
 */
export function generateInvitationToken(): { token: string; hashedToken: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hashedToken: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Long enough for somebody on holiday, short enough that a stale link dies. */
export const INVITATION_DAYS = 7;

export function invitationExpiry(now: Date = new Date()): Date {
  const expires = new Date(now);
  expires.setDate(expires.getDate() + INVITATION_DAYS);
  return expires;
}

export type InvitationState = "ok" | "not-found" | "expired" | "accepted" | "revoked";

/**
 * Whether an invitation may still be used.
 *
 * Expiry is worked out here rather than trusted from the stored status: nothing
 * sweeps the table, so a `PENDING` row whose date has passed is the normal case,
 * not an anomaly.
 */
export function invitationState(
  invitation: { status: InvitationStatus; expiresAt: Date } | null,
  now: Date = new Date(),
): InvitationState {
  if (!invitation) return "not-found";
  if (invitation.status === InvitationStatus.ACCEPTED) return "accepted";
  if (invitation.status === InvitationStatus.REVOKED) return "revoked";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "expired";
  return "ok";
}

/** The URL sent to the invitee. It lives on the company's own subdomain. */
export function invitationUrl(slug: string, token: string, rootDomain: string): string {
  const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${rootDomain}/join/${token}`;
}
