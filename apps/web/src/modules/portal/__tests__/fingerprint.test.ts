import { acceptanceDigest, sha256Hex, type AcceptanceRecord } from "../fingerprint";

const record: AcceptanceRecord = {
  quoteId: "q1",
  quoteNumber: 17,
  total: "1000.00",
  currency: "NZD",
  statementText: "Bruno Díaz agrees to and accepts this quote.",
  acceptedByName: "Bruno Díaz",
  acceptedByEmail: "bruno@example.com",
  verifiedEmail: true,
  signatureType: "DRAWN",
  signatureDigest: sha256Hex("M1,2L3,4"),
  signatureDevice: "TOUCH_DEVICE",
  acceptedAt: new Date("2026-10-17T10:00:00.000Z"),
  ipAddress: "203.0.113.7",
  userAgent: "Mozilla/5.0",
};

describe("acceptanceDigest", () => {
  it("is the same for the same record — it can be recomputed to check one", () => {
    expect(acceptanceDigest(record)).toBe(acceptanceDigest({ ...record }));
    expect(acceptanceDigest(record)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(Object.keys(record) as Array<keyof AcceptanceRecord>)(
    "changes when %s changes — an edited row stops matching",
    (key) => {
      const original = record[key];
      const changed =
        original instanceof Date
          ? new Date(original.getTime() + 1000)
          : typeof original === "boolean"
            ? !original
            : typeof original === "number"
              ? original + 1
              : original === null
                ? "x"
                : `${original}x`;
      expect(acceptanceDigest({ ...record, [key]: changed })).not.toBe(acceptanceDigest(record));
    },
  );
});

describe("sha256Hex", () => {
  it("changes with a single point of the signature", () => {
    expect(sha256Hex("M1,2L3,4")).not.toBe(sha256Hex("M1,2L3,5"));
  });
});
