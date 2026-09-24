import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatNumber } from "@/lib/format";
import { periodFromParams, previousPeriod } from "@/modules/reports/period";
import {
  breakdownFor,
  decisionTiming,
  leadFunnel,
  quoteSeries,
  repPerformance,
  type Bucket,
  type DisplayAs,
} from "@/modules/reports/service";
import { percentChange } from "@/modules/reports/metrics";
import { acceptanceRate } from "@/modules/reports/series";
import { measure } from "@/modules/reports/metrics";
import { PeriodFilter } from "@/modules/reports/period-filter";
import { StatusDonut } from "@/modules/reports/donut";
import { TrendChart } from "@/modules/reports/trend-chart";
import { SeriesTable } from "@/modules/reports/series-table";
import { FunnelChart } from "@/modules/reports/funnel";
import { RepTable } from "@/modules/reports/rep-table";
import { Delta } from "@/modules/reports/delta";
import {
  ChartSkeleton,
  PanelSkeleton,
  StatsSkeleton,
} from "@/modules/reports/skeletons";

export async function generateMetadata() {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

type Params = Record<string, string | string[] | undefined>;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("reports");

  if (!can(ctx, "reports.read")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const raw = await searchParams;

  // Every panel fetches its own data and suspends on its own. The key changes
  // with any filter, which is what makes React show the skeleton again instead
  // of leaving the previous period's figures on screen while the new ones load.
  const key = new URLSearchParams(
    Object.entries(raw).map(([name, value]) => [
      name,
      String(Array.isArray(value) ? value[0] : (value ?? "")),
    ]),
  ).toString();

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Suspense fallback={null}>
        <PeriodFilter years={years} />
      </Suspense>

      <Suspense key={`stats-${key}`} fallback={<StatsSkeleton />}>
        <StatsPanel params={raw} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Suspense key={`donut-${key}`} fallback={<ChartSkeleton />}>
            <BreakdownPanel params={raw} />
          </Suspense>
        </div>

        <div className="lg:col-span-3">
          <Suspense key={`trend-${key}`} fallback={<ChartSkeleton />}>
            <TrendPanel params={raw} />
          </Suspense>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense
          key={`funnel-${key}`}
          fallback={<PanelSkeleton rows={3} height="h-10" />}
        >
          <FunnelPanel params={raw} />
        </Suspense>

        <Suspense key={`timing-${key}`} fallback={<PanelSkeleton rows={3} />}>
          <TimingPanel params={raw} />
        </Suspense>
      </div>

      {can(ctx, "quotes.read.all") ? (
        <Suspense key={`reps-${key}`} fallback={<PanelSkeleton rows={4} />}>
          <RepPanel params={raw} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** What the company measures in, shared by every panel that shows money. */
async function money() {
  const ctx = await requireCompanyContext();
  return (value: number) =>
    formatMoney(value, ctx.company.currency, ctx.company.formatLocale);
}

function pickFrom(params: Params): DisplayAs {
  if (params.display === "count") return "count";
  if (params.display === "average") return "average";
  return "value";
}

/** The period's headline figures, each against the same period before it. */
async function StatsPanel({ params }: { params: Params }) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("reports");
  const period = periodFromParams(params);
  const before = previousPeriod(period);
  const display = pickFrom(params);

  const [current, previous] = await Promise.all([
    breakdownFor(period.from.toISOString(), period.to.toISOString()),
    breakdownFor(before.from.toISOString(), before.to.toISOString()),
  ]);

  const format = await money();
  // Both money measures are shown as money; only the headcount is a plain number.
  const show = (bucket: Bucket) =>
    display === "count"
      ? formatNumber(bucket.count, ctx.company.formatLocale)
      : format(measure(bucket, display));
  const pick = (bucket: Bucket) => measure(bucket, display);

  const tiles = [
    { key: "sent", bucket: current.sent, was: previous.sent, color: null },
    {
      key: "accepted",
      bucket: current.accepted,
      was: previous.accepted,
      color: "var(--quote-accepted)",
    },
    {
      key: "declined",
      bucket: current.declined,
      was: previous.declined,
      color: "var(--quote-declined)",
    },
    {
      key: "awaiting",
      bucket: current.awaiting,
      was: previous.awaiting,
      color: "var(--quote-awaiting)",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.key}>
          <CardContent>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {tile.color ? (
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px]"
                  style={{ background: tile.color }}
                />
              ) : null}
              {t(tile.key)}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {show(tile.bucket)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("quoteCount", { count: tile.bucket.count })}
            </p>
            <p className="mt-2">
              <Delta
                change={percentChange(pick(tile.bucket), pick(tile.was))}
                previousLabel={before.label}
              />
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Accepted against declined.
 *
 * Only what the customer actually answered: "awaiting" is not a third outcome
 * but an absence of one, and putting it in the same ring would make the
 * acceptance rate depend on how much happens to be outstanding today.
 */
async function BreakdownPanel({ params }: { params: Params }) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("reports");
  const period = periodFromParams(params);
  const display = pickFrom(params);

  const breakdown = await breakdownFor(
    period.from.toISOString(),
    period.to.toISOString(),
  );
  const format = await money();

  /**
   * The ring needs a quantity that adds up, and an average doesn't: three
   * averages are not parts of one whole, so a ring drawn from them would mean
   * nothing. In average mode the ring — and the percentage in its middle — stay
   * on the totals, while the figures beside it show the typical quote.
   */
  const ringBasis: DisplayAs = display === "average" ? "value" : display;
  const pick = (bucket: Bucket) => measure(bucket, ringBasis);
  const show = (bucket: Bucket) =>
    display === "count"
      ? formatNumber(bucket.count, ctx.company.formatLocale)
      : format(measure(bucket, display));

  /**
   * Accepted over all three, which is what the reference panel does: on its
   * figures 50,212.11 of 407,375.72 shows as 12%, where accepted over answered
   * alone would have read 16%.
   *
   * It also keeps the centre honest — the percentage is exactly the share of the
   * ring the accepted segment occupies, so the number and the drawing can't
   * disagree.
   */
  const everything =
    pick(breakdown.accepted) + pick(breakdown.awaiting) + pick(breakdown.declined);
  const rate = acceptanceRate(pick(breakdown.accepted), everything);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("breakdownTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {display === "average" ? t("breakdownHintAverage") : t("breakdownHint")}
        </p>
        {breakdown.mixedCurrencies && display !== "count" ? (
          <p className="text-xs text-muted-foreground">
            {t("mixedCurrencies", { currency: ctx.company.currency })}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <StatusDonut
          rate={rate}
          rateLabel={`${rate}%`}
          slices={[
            {
              key: "accepted",
              label: t("accepted"),
              value: pick(breakdown.accepted),
              count: breakdown.accepted.count,
              formatted: show(breakdown.accepted),
            },
            {
              key: "awaiting",
              label: t("awaiting"),
              value: pick(breakdown.awaiting),
              count: breakdown.awaiting.count,
              formatted: show(breakdown.awaiting),
            },
            {
              key: "declined",
              label: t("declined"),
              value: pick(breakdown.declined),
              count: breakdown.declined.count,
              formatted: show(breakdown.declined),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

async function TrendPanel({ params }: { params: Params }) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("reports");
  const period = periodFromParams(params);
  const display = pickFrom(params);
  const rolling =
    Number(
      Array.isArray(params.rolling) ? params.rolling[0] : (params.rolling ?? 0),
    ) || 0;

  const series = await quoteSeries(ctx, period, display, rolling);

  // Chart components are client components and can't receive functions: they're
  // handed the parameters and build the formatter themselves.
  const format = {
    display,
    currency: ctx.company.currency,
    formatLocale: ctx.company.formatLocale,
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("trendTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TrendChart points={series} format={format} />
        {/* The accessible alternative to the chart. */}
        <SeriesTable points={series} format={format} />
      </CardContent>
    </Card>
  );
}

async function FunnelPanel({ params }: { params: Params }) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("reports");
  const funnel = await leadFunnel(ctx, periodFromParams(params));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("funnel.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("funnel.hint")}</p>
      </CardHeader>
      <CardContent>
        <FunnelChart funnel={funnel} />
      </CardContent>
    </Card>
  );
}

async function TimingPanel({ params }: { params: Params }) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("reports.timing");
  const timing = await decisionTiming(ctx, periodFromParams(params));

  const days = (value: number | null) =>
    value === null ? "—" : t("days", { days: value });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <Line label={t("toDecision")} value={days(timing.medianToDecision)} />
          <Line label={t("waiting")} value={days(timing.medianWaiting)} />
          <Line
            label={t("stale", { days: timing.staleAfterDays })}
            value={String(timing.stale)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

async function RepPanel({ params }: { params: Params }) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("reports.reps");
  const rows = await repPerformance(ctx, periodFromParams(params));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <RepTable
          rows={rows}
          currency={ctx.company.currency}
          formatLocale={ctx.company.formatLocale}
        />
      </CardContent>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
