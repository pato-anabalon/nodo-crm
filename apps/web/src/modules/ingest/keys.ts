import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { IngestKeyType } from "@/generated/prisma/enums";

/**
 * Ingest API keys.
 *
 * Only the token's hash is stored; the full value is shown once, at creation.
 * The hash is SHA-256 rather than bcrypt on purpose: the token is 256 random
 * bits, not a password a person chose, so there's nothing to protect against
 * brute force and the lookup is better off being cheap.
 */

const PREFIXES: Record<IngestKeyType, string> = {
  [IngestKeyType.PUBLIC]: "nodo_pk_",
  [IngestKeyType.SECRET]: "nodo_sk_",
};

/** Visible characters of the secret kept so the key can be recognised. */
const VISIBLE_CHARS = 6;

export type GeneratedKey = {
  /** The full token. The only thing shown to the user, once. */
  token: string;
  /** What's stored to identify it in the list: `nodo_pk_a1b2c3`. */
  prefix: string;
  hashedSecret: string;
};

export function generateIngestKey(type: IngestKeyType): GeneratedKey {
  const secret = randomBytes(24).toString("base64url");
  const token = `${PREFIXES[type]}${secret}`;

  return {
    token,
    prefix: `${PREFIXES[type]}${secret.slice(0, VISIBLE_CHARS)}`,
    hashedSecret: hashIngestKey(token),
  };
}

export function hashIngestKey(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function keyTypeFromToken(token: string): IngestKeyType | null {
  if (token.startsWith(PREFIXES[IngestKeyType.PUBLIC])) return IngestKeyType.PUBLIC;
  if (token.startsWith(PREFIXES[IngestKeyType.SECRET])) return IngestKeyType.SECRET;
  return null;
}

/** Constant-time comparison, in case hashes ever get compared. */
export function hashesMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Reads the token from the headers.
 *
 * Both `Authorization: Bearer …` and `X-Api-Key` are accepted, because forms on
 * other people's sites use one or the other depending on the library at hand.
 */
export function readToken(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const value = authorization.slice(7).trim();
    if (value) return value;
  }

  const apiKey = headers.get("x-api-key")?.trim();
  return apiKey || null;
}
