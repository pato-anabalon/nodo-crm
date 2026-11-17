import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IngestOutcome } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";

export type Rejection = {
  id: string;
  outcome: IngestOutcome;
  origin: string | null;
  detail: string | null;
  createdAt: Date;
  keyName: string | null;
};

/**
 * The API's latest rejections.
 *
 * It exists so a company can see for itself why its form isn't getting through —
 * a mistyped domain, a revoked key, too many submissions — instead of having to
 * write in and ask.
 */
export async function RejectionLog({
  rejections,
  formatLocale,
  timezone,
}: {
  rejections: Rejection[];
  formatLocale: string;
  timezone: string;
}) {
  const t = await getTranslations("ingest");

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("rejections")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("rejectionsBody")}</p>
      </CardHeader>

      <CardContent>
        {rejections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRejections")}</p>
        ) : (
          <ul className="space-y-2">
            {rejections.map((rejection) => (
              <li
                key={rejection.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 text-sm"
              >
                <Badge variant="destructive">{t(`outcomes.${rejection.outcome}`)}</Badge>
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {rejection.detail ?? rejection.origin ?? "—"}
                </span>
                {rejection.keyName ? (
                  <span className="text-xs text-muted-foreground">{rejection.keyName}</span>
                ) : null}
                <time
                  dateTime={rejection.createdAt.toISOString()}
                  className="text-xs text-muted-foreground tabular-nums"
                >
                  {formatDateTime(rejection.createdAt, formatLocale, timezone)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
