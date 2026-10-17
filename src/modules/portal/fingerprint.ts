import { createHash } from "node:crypto";

/**
 * The acceptance's digital fingerprint: hashes over what backs it.
 *
 * What it proves is narrow and worth saying exactly. The signature digest
 * changes if a single point of the strokes changes. The record digest covers
 * every field below in a fixed order, so a row edited in the database after
 * the fact stops matching what it was sealed with. Neither proves who held the
 * pen — that is what the email link is for — and the strokes carry no timing,
 * so nothing here claims to replay how the signature was written.
 */

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type AcceptanceRecord = {
  quoteId: string;
  quoteNumber: number;
  total: string;
  currency: string;
  statementText: string;
  acceptedByName: string;
  acceptedByEmail: string | null;
  verifiedEmail: boolean;
  signatureType: string;
  signatureDigest: string | null;
  signatureDevice: string | null;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

/**
 * The record digest. Keys are listed rather than taken from the object, so a
 * field added to the type later can't silently reorder — or join — the hash
 * of acceptances sealed before it.
 */
export function acceptanceDigest(record: AcceptanceRecord): string {
  const ordered = [
    record.quoteId,
    record.quoteNumber,
    record.total,
    record.currency,
    record.statementText,
    record.acceptedByName,
    record.acceptedByEmail,
    record.verifiedEmail,
    record.signatureType,
    record.signatureDigest,
    record.signatureDevice,
    record.acceptedAt.toISOString(),
    record.ipAddress,
    record.userAgent,
  ];
  return sha256Hex(JSON.stringify(ordered));
}
