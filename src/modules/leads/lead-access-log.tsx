import { getTranslations } from "next-intl/server";
import { LeadAccessKind } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";
import { LOGGED_FIELDS } from "./access-log";

export type AccessLogEntry = {
  id: string;
  kind: LeadAccessKind;
  detail: string | null;
  createdAt: Date;
  user: { name: string | null; email: string };
};

/**
 * Who opened the lead and who changed it. A section of its own, apart from the
 * activity log: that one is the lead's story, this is the audit trail, and
 * mixed together every call would be buried under "María opened this".
 */
export async function LeadAccessLogList({
  entries,
  formatLocale,
  timezone,
}: {
  entries: AccessLogEntry[];
  formatLocale: string;
  timezone: string;
}) {
  const t = await getTranslations("leads.accessLog");

  // A field name written by an older version of the code is shown as written,
  // like a status nobody can translate: never worth a missing-message error.
  const fieldName = (field: string) =>
    (LOGGED_FIELDS as readonly string[]).includes(field) ? t(`fields.${field}`) : field;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-background text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">{entry.user.name ?? entry.user.email}</span>{" "}
                <span className="text-muted-foreground">
                  {entry.kind === LeadAccessKind.UPDATED
                    ? t("updated", {
                        fields: (entry.detail ?? "").split(",").filter(Boolean).map(fieldName).join(", "),
                      })
                    : t("viewed")}
                </span>
              </span>
              <time dateTime={entry.createdAt.toISOString()} className="text-xs text-muted-foreground">
                {formatDateTime(entry.createdAt, formatLocale, timezone)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
