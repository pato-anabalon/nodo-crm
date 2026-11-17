import { createTranslator } from "next-intl";
import enGB from "../../../../messages/en-GB.json";
import { fingerprintRows, type FingerprintAcceptance } from "../fingerprint-rows";

const t = createTranslator({ locale: "en-GB", messages: enGB, namespace: "portal.fingerprint" });

const base: FingerprintAcceptance = {
  acceptedAt: new Date("2026-10-15T00:45:47Z"),
  acceptedByEmail: "bruno@example.com",
  verifiedEmail: true,
  ipAddress: "2406:5a00::1",
  userAgent: "Mozilla/5.0 (Windows NT 10.0)",
  signatureDigest: "a".repeat(64),
  signatureDevice: "TOUCH_DEVICE",
  signatureDeviceUserAgent: "Mozilla/5.0 (iPhone)",
  signatureDeviceIp: "203.0.113.9",
  recordDigest: "b".repeat(64),
};

const options = { formatLocale: "en-NZ", timezone: "Pacific/Auckland" };

describe("fingerprintRows", () => {
  it("lists every row in a fixed order when the acceptance has them all", () => {
    expect(fingerprintRows(base, t, options).map((row) => row.key)).toEqual([
      "timestamp",
      "email",
      "ipAddress",
      "signatureDigest",
      "signedOn",
      "userAgent",
      "recordDigest",
    ]);
  });

  it("gives the time in UTC and in the company's zone", () => {
    const [timestamp] = fingerprintRows(base, t, options);
    expect(timestamp.lines).toHaveLength(2);
    expect(timestamp.lines[0].text).toMatch(/UTC/);
    expect(fingerprintRows(base, t, { ...options, timezone: "UTC" })[0].lines).toHaveLength(1);
  });

  it("only calls an address verified when it was", () => {
    const email = (verifiedEmail: boolean | null) =>
      fingerprintRows({ ...base, verifiedEmail }, t, options).find((row) => row.key === "email");
    expect(email(true)?.label).toBe("Verified by email");
    expect(email(false)?.label).toBe("Email");
    expect(email(false)?.lines).toHaveLength(1);
  });

  it("claims nothing an acceptance from before the fingerprint can't back", () => {
    const rows = fingerprintRows(
      {
        ...base,
        verifiedEmail: null,
        signatureDigest: null,
        signatureDevice: null,
        signatureDeviceUserAgent: null,
        signatureDeviceIp: null,
        recordDigest: null,
      },
      t,
      options,
    );
    expect(rows.map((row) => row.key)).toEqual(["timestamp", "email", "ipAddress", "userAgent"]);
  });
});
