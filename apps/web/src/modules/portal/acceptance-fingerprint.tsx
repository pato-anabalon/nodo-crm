import { getTranslations } from "next-intl/server";
import { Fingerprint } from "lucide-react";
import {
  fingerprintRows,
  type FingerprintAcceptance,
  type FingerprintTone,
} from "./fingerprint-rows";

export type { FingerprintAcceptance };

const TONE_CLASS: Record<FingerprintTone, string> = {
  time: "font-mono",
  address: "font-mono break-all",
  addressStrong: "font-mono font-semibold break-all",
  code: "font-mono text-xs break-all",
  codeMuted: "font-mono text-xs break-all text-muted-foreground",
  hint: "text-muted-foreground",
  strong: "font-semibold",
  plain: "",
};

/**
 * What backs an acceptance, folded away until asked for.
 *
 * One component for the customer's page and the team's card, and the rows
 * themselves come from `fingerprintRows`, which the PDF draws from too. A
 * `<details>` rather than state: it opens with no JavaScript, and prints open
 * or closed as it stands.
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
  const rows = fingerprintRows(acceptance, t, { formatLocale, timezone });

  return (
    <details className="group rounded-md border bg-muted/30 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium select-none">
        <Fingerprint className="size-4 shrink-0" />
        <span className="group-open:hidden">{t("show")}</span>
        <span className="hidden group-open:inline">{t("hide")}</span>
      </summary>

      <dl className="divide-y border-t">
        {rows.map((row) => (
          <div key={row.key} className="space-y-1 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="space-y-0.5">
              {row.lines.map((line, index) => (
                <p key={index} className={TONE_CLASS[line.tone] || undefined}>
                  {line.text}
                </p>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
