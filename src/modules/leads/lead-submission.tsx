import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

/** Fields already shown in the lead's header; they aren't repeated below. */
const PROMOTED_FIELDS = new Set([
  "name",
  "email",
  "phone",
  "company",
  "companyName",
  "message",
]);

/** Technical keys that mean nothing to a salesperson. */
const HIDDEN_FIELDS = new Set([
  "token",
  "apiKey",
  "api_key",
  "recaptcha",
  "g-recaptcha-response",
  "honeypot",
  "_honey",
  "submit",
]);

type Submission = {
  payload: unknown;
  sourceUrl: string | null;
  utmCampaign: string | null;
  receivedAt: Date;
};

/**
 * The form exactly as it arrived.
 *
 * Every company has its own, so it can't be laid out field by field: the payload
 * is walked and shown as label/value pairs, in the order it came in.
 */
export async function LeadSubmissionPanel({
  submission,
  formatLocale,
  timezone,
}: {
  submission: Submission | null;
  formatLocale: string;
  timezone: string;
}) {
  const t = await getTranslations("leads.submission");

  if (!submission) {
    return <p className="text-sm text-muted-foreground">{t("noSubmission")}</p>;
  }

  const entries = readableEntries(submission.payload);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {entries.map(([label, value]) => (
            <div key={label} className="min-w-0 space-y-0.5">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {humanise(label)}
              </dt>
              <dd className="text-sm break-words whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <p>
            {t("receivedAt", {
              date: formatDateTime(submission.receivedAt, formatLocale, timezone),
            })}
          </p>
          {submission.sourceUrl ? <p>{t("from", { url: submission.sourceUrl })}</p> : null}
          {submission.utmCampaign ? (
            <p>{t("campaign", { campaign: submission.utmCampaign })}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Showable pairs from the payload, already filtered and flattened. */
export function readableEntries(payload: unknown): Array<[string, string]> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  return Object.entries(payload as Record<string, unknown>)
    .filter(([key]) => !HIDDEN_FIELDS.has(key) && !PROMOTED_FIELDS.has(key))
    .map(([key, value]) => [key, stringify(value)] as [string, string])
    .filter(([, value]) => value !== "");
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "✓" : "✗";
  if (Array.isArray(value)) return value.map(stringify).filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

/**
 * `preferred_contact` and `serviceType` -> `Preferred contact`.
 *
 * Sentence case, not title case: these are form labels, and this way they read
 * the same whether they arrive in snake_case or camelCase.
 */
export function humanise(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
