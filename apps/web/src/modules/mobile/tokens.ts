import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * The tokens and codes of the app's sign-in, kept apart from the queries so the
 * edges — expiry, sliding, attempts — sit in tests.
 *
 * Only hashes are stored, the same rule as quote links, invitations and ingest
 * keys: a database dump must not be enough to sign in as anybody.
 */

/** How long a phone stays signed in without being used. */
export const SESSION_DAYS = 90;
/** A session is pushed forward at most once a day, not on every request. */
export const SLIDE_AFTER_HOURS = 24;
/** "Trust this device": a code once a month rather than every morning. */
export const TRUST_DAYS = 30;
/** Long enough to switch to the mail app and back; short enough to be worthless later. */
export const CODE_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;
/** Codes emailed per person in the window — Resend's free plan allows 100 a day in all. */
export const CODES_PER_WINDOW = 3;
/** Wrong passwords before the app is told to wait. */
export const FAILURES_PER_EMAIL = 10;
export const FAILURES_PER_IP = 30;
export const WINDOW_MINUTES = 15;

const TOKEN_PREFIX = "nodo_mt_";

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** SHA-256 is enough: the token carries 256 random bits, so there is nothing to guess. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** The device id is the app's own random value; hashed so a dump can't pair it with a phone. */
export const hashDeviceId = hashToken;

/** The token out of `Authorization: Bearer …`, or null when it isn't one of ours. */
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];
  return token?.startsWith(TOKEN_PREFIX) ? token : null;
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DAYS * DAY);
}

export function trustExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + TRUST_DAYS * DAY);
}

export function codeExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + CODE_MINUTES * MINUTE);
}

export function windowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - WINDOW_MINUTES * MINUTE);
}

export type SessionState = "ok" | "revoked" | "expired";

export function sessionState(
  session: { revokedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): SessionState {
  if (session.revokedAt) return "revoked";
  if (session.expiresAt.getTime() <= now.getTime()) return "expired";
  return "ok";
}

/** Whether to write a new expiry on this request: once a day is plenty for a 90-day window. */
export function shouldSlide(lastUsedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastUsedAt.getTime() >= SLIDE_AFTER_HOURS * 60 * MINUTE;
}

/** Six digits, from a CSPRNG, leading zeros kept. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Keyed by the server's secret and salted with the challenge, so six digits
 * can't be looked up in a table built once from a dump. Online guessing is what
 * `CODE_MAX_ATTEMPTS` is for.
 */
export function hashCode(challengeId: string, code: string, secret: string): string {
  return createHmac("sha256", secret).update(`${challengeId}:${code}`, "utf8").digest("hex");
}

export function codeMatches(stored: string, challengeId: string, code: string, secret: string): boolean {
  const given = Buffer.from(hashCode(challengeId, code.trim(), secret), "hex");
  const expected = Buffer.from(stored, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type ChallengeState = "ok" | "not-found" | "used" | "expired" | "locked" | "other-device";

export function challengeState(
  challenge: { consumedAt: Date | null; expiresAt: Date; attempts: number; deviceIdHash: string } | null,
  deviceIdHash: string,
  now: Date = new Date(),
): ChallengeState {
  if (!challenge) return "not-found";
  if (challenge.consumedAt) return "used";
  if (challenge.expiresAt.getTime() <= now.getTime()) return "expired";
  if (challenge.attempts >= CODE_MAX_ATTEMPTS) return "locked";
  // A code is good only on the phone that asked for it.
  if (challenge.deviceIdHash !== deviceIdHash) return "other-device";
  return "ok";
}

/** "p•••@plasterpro.co.nz": enough for the person to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}•••@${domain}`;
}
