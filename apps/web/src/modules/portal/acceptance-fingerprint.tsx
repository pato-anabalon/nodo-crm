import { getTranslations } from "next-intl/server";
import { Fingerprint } from "lucide-react";

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

/**
 * What backs an acceptance, folded away until asked for.
 *
 * One component for the customer's page and the team's card, so the two can
 * never describe the same acceptance differently. A `<details>` rather than
 * state: it opens with no JavaScript, and prints open or closed as it stands.
 *
 * Each row appears only when there is something true to put in it — an
 * acceptance from before the fingerprint existed shows its time, address and
 * browser and nothing it can't vouch for. "Verified" is said only when the
 * link really was one sent to that address alone.
 */
export async function AcceptanceFingerprint({
  acceptance,
  locale,
  formatLocale,
  timezone,
}: {
  acceptance: FingerprintAcceptance;
  locale: string;
  formatLocale: string;
  timezone: string;
}) {
  const t = await getTranslations({ locale, namespace: "portal.fingerprint" });

  const at = (timeZone: string) =>
    new Intl.DateTimeFormat(formatLocale, { dateStyle: "full", timeStyle: "long", timeZone }).format(
      acceptance.acceptedAt,
    );

  return (
    <details className="group rounded-md border bg-muted/30 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium select-none">
        <Fingerprint className="size-4 shrink-0" />
        <span className="group-open:hidden">{t("show")}</span>
        <span className="hidden group-open:inline">{t("hide")}</span>
      </summary>

      <dl className="divide-y border-t">
        <Row label={t("timestamp")}>
          <p className="font-mono">{at("UTC")}</p>
          {timezone !== "UTC" ? <p className="text-muted-foreground">{at(timezone)}</p> : null}
        </Row>

        {acceptance.acceptedByEmail ? (
          <Row label={acceptance.verifiedEmail ? t("verifiedEmail") : t("email")}>
            <p className="font-mono font-semibold break-all">{acceptance.acceptedByEmail}</p>
            {acceptance.verifiedEmail ? (
              <p className="text-muted-foreground">{t("verifiedEmailHint")}</p>
            ) : null}
          </Row>
        ) : null}

        {acceptance.ipAddress ? (
          <Row label={t("ipAddress")}>
            <p className="font-mono break-all">{acceptance.ipAddress}</p>
          </Row>
        ) : null}

        {acceptance.signatureDigest ? (
          <Row label={t("signatureDigest")}>
            <p className="font-mono text-xs break-all text-muted-foreground">
              {acceptance.signatureDigest}
            </p>
            <p className="text-muted-foreground">{t("signatureDigestHint")}</p>
          </Row>
        ) : null}

        {acceptance.signatureDevice === "TOUCH_DEVICE" ? (
          <Row label={t("signedOn")}>
            <p className="font-semibold">{t("touchDevice")}</p>
            {acceptance.signatureDeviceUserAgent ? (
              <p className="font-mono text-xs break-all">{acceptance.signatureDeviceUserAgent}</p>
            ) : null}
            {acceptance.signatureDeviceIp ? (
              <p className="font-mono text-xs break-all text-muted-foreground">
                {acceptance.signatureDeviceIp}
              </p>
            ) : null}
          </Row>
        ) : acceptance.signatureDevice === "THIS_DEVICE" ? (
          <Row label={t("signedOn")}>
            <p>{t("thisDevice")}</p>
          </Row>
        ) : null}

        {acceptance.userAgent ? (
          <Row label={t("userAgent")}>
            <p className="font-mono text-xs break-all">{acceptance.userAgent}</p>
          </Row>
        ) : null}

        {acceptance.recordDigest ? (
          <Row label={t("recordDigest")}>
            <p className="font-mono text-xs break-all text-muted-foreground">
              {acceptance.recordDigest}
            </p>
            <p className="text-muted-foreground">{t("recordDigestHint")}</p>
          </Row>
        ) : null}
      </dl>
    </details>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="space-y-0.5">{children}</dd>
    </div>
  );
}
