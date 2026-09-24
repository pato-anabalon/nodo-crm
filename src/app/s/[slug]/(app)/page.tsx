import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { roleDisplayName } from "@/lib/auth/role-name";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { leadPipelineSummary } from "@/modules/leads/service";
import { listQuotes } from "@/modules/quotes/service";
import { LEAD_PIPELINE, isClosedStatus } from "@/modules/leads/constants";
import { QUOTE_STATUS_CLASS } from "@/modules/quotes/constants";
import { formatMoney, formatQuoteNumber } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage() {
  const ctx = await requireCompanyContext();
  const [t, tLeads, tQuotes, tRoles] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("leads"),
    getTranslations("quotes"),
    getTranslations("roles"),
  ]);

  const pipeline = can(ctx, "leads.read") ? await leadPipelineSummary(ctx) : [];
  const recentQuotes = can(ctx, "quotes.read")
    ? (await listQuotes(ctx, { page: 1, section: "all" })).items.slice(0, 5)
    : [];

  const byStatus = new Map(pipeline.map((row) => [row.status, row]));
  const open = pipeline.filter((row) => !isClosedStatus(row.status));
  const openValue = open.reduce((acc, row) => acc + row.value, 0);
  const openCount = open.reduce((acc, row) => acc + row.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("greeting", { name: ctx.user.name ?? ctx.user.email })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("companyAndRole", {
            company: ctx.company.name,
            role: roleDisplayName(ctx.role, tRoles),
          })}
        </p>
      </div>

      {can(ctx, "leads.read") ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={t("openOpportunities")} value={String(openCount)} />
            <Metric
              label={t("pipelineValue")}
              value={formatMoney(
                openValue,
                ctx.company.currency,
                ctx.company.formatLocale,
              )}
            />
            <Metric
              label={t("won")}
              value={String(byStatus.get("WON")?.count ?? 0)}
            />
            <Metric
              label={t("lost")}
              value={String(byStatus.get("LOST")?.count ?? 0)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("funnel")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {LEAD_PIPELINE.map((status) => {
                const count = byStatus.get(status)?.count ?? 0;
                const share =
                  openCount > 0 ? Math.round((count / openCount) * 100) : 0;

                return (
                  <div key={status} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {tLeads(`status.${status}`)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, share)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      ) : null}

      {recentQuotes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("latestQuotes")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentQuotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{quote.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatQuoteNumber(ctx.company.quotePrefix, quote.number)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={QUOTE_STATUS_CLASS[quote.status]}>
                    {tQuotes(`status.${quote.status}`)}
                  </Badge>
                  <span className="tabular-nums">
                    {formatMoney(
                      Number(quote.total),
                      quote.currency,
                      ctx.company.formatLocale,
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
