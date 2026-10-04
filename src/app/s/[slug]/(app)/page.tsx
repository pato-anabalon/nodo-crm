import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { roleDisplayName } from "@/lib/auth/role-name";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { leadPipelineSummary } from "@/modules/leads/service";
import { listQuotes, recentQuotesByStatus } from "@/modules/quotes/service";
import { LEAD_PIPELINE, isClosedStatus } from "@/modules/leads/constants";
import { QUOTE_STATUS_CLASS } from "@/modules/quotes/constants";
import { HiddenAmount } from "@/modules/quotes/hidden-amount";
import { QuoteStatus } from "@/generated/prisma/enums";
import { formatMoney, formatQuoteNumber } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

/** A row's worth of what every quote panel below shows, pre-translated. */
type QuoteRow = {
  id: string;
  title: string;
  reference: string;
  statusLabel: string;
  statusClass: string;
  amount: React.ReactNode;
};

export default async function DashboardPage() {
  const ctx = await requireCompanyContext();
  const [t, tLeads, tQuotes, tRoles] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("leads"),
    getTranslations("quotes"),
    getTranslations("roles"),
  ]);

  const showFunnel = can(ctx, "leads.read");
  const showQuotes = can(ctx, "quotes.read");
  const canSeeAmounts = can(ctx, "quotes.read.amounts");

  const [pipeline, recentQuotes, lastSent, lastAccepted] = await Promise.all([
    showFunnel ? leadPipelineSummary(ctx) : Promise.resolve([]),
    showQuotes
      ? listQuotes(ctx, { page: 1, section: "all" }).then((r) => r.items.slice(0, 5))
      : Promise.resolve([]),
    showQuotes ? recentQuotesByStatus(ctx, QuoteStatus.SENT, "sentAt") : Promise.resolve([]),
    showQuotes
      ? recentQuotesByStatus(ctx, QuoteStatus.ACCEPTED, "decidedAt")
      : Promise.resolve([]),
  ]);

  const toRows = (
    quotes: Array<{
      id: string;
      title: string;
      number: number;
      status: QuoteStatus;
      total: unknown;
      currency: string;
    }>,
  ): QuoteRow[] =>
    quotes.map((quote) => ({
      id: quote.id,
      title: quote.title,
      reference: formatQuoteNumber(ctx.company.quotePrefix, quote.number),
      statusLabel: tQuotes(`status.${quote.status}`),
      statusClass: QUOTE_STATUS_CLASS[quote.status],
      amount: canSeeAmounts ? (
        formatMoney(Number(quote.total), quote.currency, ctx.company.formatLocale)
      ) : (
        <HiddenAmount />
      ),
    }));

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

      {showFunnel ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={t("openOpportunities")} value={String(openCount)} />
          <Metric
            label={t("pipelineValue")}
            value={formatMoney(openValue, ctx.company.currency, ctx.company.formatLocale)}
          />
          <Metric label={t("won")} value={String(byStatus.get("WON")?.count ?? 0)} />
          <Metric label={t("lost")} value={String(byStatus.get("LOST")?.count ?? 0)} />
        </div>
      ) : null}

      {/* Funnel and latest quotes read as one pair of questions — what's
          moving, and what moved most recently — so they sit in the same row
          at the same height rather than one stacked above the other. */}
      {showFunnel || showQuotes ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {showFunnel ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">{t("funnel")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {LEAD_PIPELINE.map((status) => {
                  const count = byStatus.get(status)?.count ?? 0;
                  const share = openCount > 0 ? Math.round((count / openCount) * 100) : 0;

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
          ) : null}

          {showQuotes ? (
            <QuoteListCard
              title={t("latestQuotes")}
              emptyLabel={t("noQuotesYet")}
              rows={toRows(recentQuotes)}
            />
          ) : null}
        </div>
      ) : null}

      {showQuotes ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <QuoteListCard
            title={t("lastSent")}
            emptyLabel={t("noneSentYet")}
            rows={toRows(lastSent)}
          />
          <QuoteListCard
            title={t("lastAccepted")}
            emptyLabel={t("noneAcceptedYet")}
            rows={toRows(lastAccepted)}
          />
        </div>
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

/** The format `latestQuotes`, `lastSent` and `lastAccepted` all share. */
function QuoteListCard({
  title,
  emptyLabel,
  rows,
}: {
  title: string;
  emptyLabel: string;
  rows: QuoteRow[];
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={`/quotes/${row.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
            >
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={row.statusClass}>
                  {row.statusLabel}
                </Badge>
                <span className="tabular-nums">{row.amount}</span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
