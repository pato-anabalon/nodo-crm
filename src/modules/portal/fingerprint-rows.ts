export type FingerprintAcceptance = {
  acceptedAt: Date;
  acceptedByEmail: string | null;
  verifiedEmail: boolean | null;
  ipAddress: string | null;
  userAgent: string | null;
  signatureDigest: string | null;
  signatureDevice: string | null;
  signatureDeviceUserAgent: string | null;
  signatureDeviceIp: string | null;
  recordDigest: string | null;
};

type FingerprintKey =
  | "timestamp"
  | "verifiedEmail"
  | "email"
  | "verifiedEmailHint"
  | "ipAddress"
  | "signatureDigest"
  | "signatureDigestHint"
  | "signedOn"
  | "touchDevice"
  | "thisDevice"
  | "userAgent"
  | "recordDigest"
  | "recordDigestHint";

/**
 * How a line reads, not how it is drawn: the web and the PDF each turn these
 * into their own styles. `code` is a hash or a browser string — long, set
 * small; `hint` is the sentence that explains the value above it.
 */
export type FingerprintTone =
  | "time"
  | "address"
  | "addressStrong"
  | "code"
  | "codeMuted"
  | "hint"
  | "strong"
  | "plain";

export type FingerprintRow = {
  key: string;
  label: string;
  lines: Array<{ text: string; tone: FingerprintTone }>;
};

/**
 * What the fingerprint says about an acceptance, row by row.
 *
 * The customer's page, the team's card and the PDF all draw from this, so the
 * three can never describe the same acceptance differently. Each row appears
 * only when there is something true to put in it — an acceptance from before
 * the fingerprint existed shows its time, address and browser and nothing it
 * can't vouch for. "Verified" is said only when the link really was one sent
 * to that address alone.
 */
export function fingerprintRows(
  acceptance: FingerprintAcceptance,
  t: (key: FingerprintKey) => string,
  { formatLocale, timezone }: { formatLocale: string; timezone: string },
): FingerprintRow[] {
  const at = (timeZone: string) =>
    new Intl.DateTimeFormat(formatLocale, { dateStyle: "full", timeStyle: "long", timeZone }).format(
      acceptance.acceptedAt,
    );

  const rows: FingerprintRow[] = [
    {
      key: "timestamp",
      label: t("timestamp"),
      lines: [
        { text: at("UTC"), tone: "time" },
        ...(timezone !== "UTC" ? [{ text: at(timezone), tone: "hint" as const }] : []),
      ],
    },
  ];

  if (acceptance.acceptedByEmail) {
    rows.push({
      key: "email",
      label: acceptance.verifiedEmail ? t("verifiedEmail") : t("email"),
      lines: [
        { text: acceptance.acceptedByEmail, tone: "addressStrong" },
        ...(acceptance.verifiedEmail ? [{ text: t("verifiedEmailHint"), tone: "hint" as const }] : []),
      ],
    });
  }

  if (acceptance.ipAddress) {
    rows.push({ key: "ipAddress", label: t("ipAddress"), lines: [{ text: acceptance.ipAddress, tone: "address" }] });
  }

  if (acceptance.signatureDigest) {
    rows.push({
      key: "signatureDigest",
      label: t("signatureDigest"),
      lines: [
        { text: acceptance.signatureDigest, tone: "codeMuted" },
        { text: t("signatureDigestHint"), tone: "hint" },
      ],
    });
  }

  if (acceptance.signatureDevice === "TOUCH_DEVICE") {
    rows.push({
      key: "signedOn",
      label: t("signedOn"),
      lines: [
        { text: t("touchDevice"), tone: "strong" },
        ...(acceptance.signatureDeviceUserAgent
          ? [{ text: acceptance.signatureDeviceUserAgent, tone: "code" as const }]
          : []),
        ...(acceptance.signatureDeviceIp ? [{ text: acceptance.signatureDeviceIp, tone: "codeMuted" as const }] : []),
      ],
    });
  } else if (acceptance.signatureDevice === "THIS_DEVICE") {
    rows.push({ key: "signedOn", label: t("signedOn"), lines: [{ text: t("thisDevice"), tone: "plain" }] });
  }

  if (acceptance.userAgent) {
    rows.push({ key: "userAgent", label: t("userAgent"), lines: [{ text: acceptance.userAgent, tone: "code" }] });
  }

  if (acceptance.recordDigest) {
    rows.push({
      key: "recordDigest",
      label: t("recordDigest"),
      lines: [
        { text: acceptance.recordDigest, tone: "codeMuted" },
        { text: t("recordDigestHint"), tone: "hint" },
      ],
    });
  }

  return rows;
}
