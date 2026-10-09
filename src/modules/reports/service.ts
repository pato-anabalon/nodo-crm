import { cache } from "react";
import { requireCompanyContext, type CompanyContext } from "@/lib/auth/session";
import { QuoteStatus } from "@/generated/prisma/enums";
import { visibilityWhere } from "@/modules/quotes/service";
import type { Period } from "./period";
import { buildSeries, divideSeries, rollingSum, type SeriesPoint } from "./series";
import { conversionRate, daysBetween, median, type DisplayAs } from "./metrics";
import { foldByCurrency, type Bucket } from "./currency";

export type { DisplayAs } from "./metrics";

export type { Bucket } from "./currency";

export type Breakdown = {
  sent: Bucket;
  accepted: Bucket;
  declined: Bucket;
  awaiting: Bucket;
  expired: Bucket;
  /** Whether any amount above leaves out quotes priced in another currency. */
  mixedCurrencies: boolean;
};


const EMPTY: Bucket = { count: 0, value: 0 };

/** Everything here needs is the window; the label and grain belong to the charts. */
export type Range = { from: Date; to: Date };

/**
 * What happened to quotes within the period.
 *
 * `accepted` and `declined` are keyed on **when the customer decided**, not when
 * the quote was written: a quote sent in January and accepted in March belongs to
 * March, which is what makes a monthly report square with what was actually
 * closed that month.
 *
 * That choice has a consequence worth knowing: `sent` and the decided figures do
 * not add up, because they count different quotes. They are shown as separate
 * measures rather than as slices of one whole.
 *
 * `awaiting` is a different kind of number again — a stock, not a flow. It is
 * what was still hanging at the close of the period, whenever it went out.
 *
 * `expired` is the flow `awaiting` quietly drops: a quote nobody ever decided
 * on, whose validity ran out. It has no `decidedAt` to key on — nobody
 * decided — so it's keyed on `validUntil` instead, the one date that actually
 * marks the event. Without this bucket, `accepted + declined + awaiting`
 * silently falls short of `sent` by however many simply ran out unanswered.
 *
 * The five add up as a stock/flow identity, not a flat sum:
 * `awaiting(start) + sent = decided + expired + awaiting(end)`. `stock-flow.ts`
 * mirrors the four `where`s below in plain booleans and its test is what
 * actually checks that identity — change a condition here and change it
 * there too, or the check stops meaning anything.
 */
export async function quoteBreakdown(ctx: CompanyContext, period: Range): Promise<Breakdown> {
  const visible = visibilityWhere(ctx);

  const [decided, sent, awaiting, expired] = await Promise.all([
    ctx.db.quote.groupBy({
      by: ["status", "currency"],
      where: {
        ...visible,
        decidedAt: { gte: period.from, lt: period.to },
        status: { in: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED] },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
    ctx.db.quote.groupBy({
      by: ["currency"],
      where: { ...visible, sentAt: { gte: period.from, lt: period.to } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    ctx.db.quote.groupBy({
      by: ["currency"],
      where: {
        ...visible,
        sentAt: { lt: period.to },
        // Undecided by the end of the period — including quotes answered later,
        // which were still open at the moment being reported on.
        AND: [
          { OR: [{ decidedAt: null }, { decidedAt: { gte: period.to } }] },
          // An expired quote never gets a `decidedAt` — nobody decided, it
          // just ran out — so the decidedAt check alone can't tell it apart
          // from one still genuinely open. `validUntil` can: a quote whose
          // validity hadn't lapsed yet as of the period's close really was
          // still awaiting an answer *at that moment*, even if it has since
          // expired; one whose validity had already run out by then wasn't,
          // whatever the row says today. Without this, every quote that's
          // since expired piles up in every past period's stock forever
          // instead of dropping out once it's dead.
          { OR: [{ validUntil: null }, { validUntil: { gte: period.to } }] },
        ],
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
    ctx.db.quote.groupBy({
      by: ["currency"],
      where: {
        ...visible,
        // Not `status: EXPIRED` — nothing in this app ever flips a quote to
        // that status on its own (only the Quotient import ever set it, from
        // Quotient's own history). A live quote that simply outlives its
        // `validUntil` stays `SENT` forever, so keying on the status would
        // make it invisible here too, the same way it was invisible in
        // `awaiting` before this bucket existed. `decidedAt: null` is what
        // "nobody answered" actually means, regardless of what the status
        // column says; `sentAt` not null excludes a draft that was never
        // shown to anyone, which can still carry a `validUntil` — it's set
        // at creation, not at send.
        sentAt: { not: null },
        decidedAt: null,
        validUntil: { gte: period.from, lt: period.to },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);

  const home = ctx.company.currency;
  const sentFold = foldByCurrency(sent, home);
  const awaitingFold = foldByCurrency(awaiting, home);
  const expiredFold = foldByCurrency(expired, home);
  const acceptedFold = foldByCurrency(
    decided.filter((row) => row.status === QuoteStatus.ACCEPTED),
    home,
  );
  const declinedFold = foldByCurrency(
    decided.filter((row) => row.status === QuoteStatus.REJECTED),
    home,
  );

  return {
    sent: sentFold.bucket,
    accepted: acceptedFold.bucket,
    declined: declinedFold.bucket,
    awaiting: awaitingFold.bucket,
    expired: expiredFold.bucket,
    mixedCurrencies:
      sentFold.foreign +
        awaitingFold.foreign +
        acceptedFold.foreign +
        declinedFold.foreign +
        expiredFold.foreign >
      0,
  };
}


/**
 * Request-scoped memo of the breakdown.
 *
 * Two panels ask for the same period — the figures and the donut — and each
 * suspends separately so a slow one can't hold up the rest. Keyed on the range
 * as text because React's cache compares arguments by identity, and two callers
 * build two different `Date` objects for the same instant.
 */
export const breakdownFor = cache(async (fromIso: string, toIso: string): Promise<Breakdown> => {
  const ctx = await requireCompanyContext();
  return quoteBreakdown(ctx, { from: new Date(fromIso), to: new Date(toIso) });
});

export type Funnel = {
  received: number;
  quoted: number;
  won: number;
  quotedRate: number;
  wonRate: number;
};

/**
 * Leads received in the period, followed through to what became of them.
 *
 * A cohort, deliberately: the leads counted at every step are the same ones. The
 * alternative — this month's leads against this month's acceptances — mixes
 * populations, and the "conversion" it produces can exceed 100% without anything
 * being wrong.
 *
 * The price is that a recent period looks worse than it will end up: leads
 * arriving yesterday haven't had time to be quoted, let alone accepted.
 */
export async function leadFunnel(ctx: CompanyContext, period: Period): Promise<Funnel> {
  const window = { createdAt: { gte: period.from, lt: period.to } };

  const [received, quoted, won] = await Promise.all([
    ctx.db.lead.count({ where: window }),
    // A draft doesn't count: the customer hasn't seen it, so nothing was quoted.
    ctx.db.lead.count({ where: { ...window, quotes: { some: { sentAt: { not: null } } } } }),
    ctx.db.lead.count({
      where: { ...window, quotes: { some: { status: QuoteStatus.ACCEPTED } } },
    }),
  ]);

  return {
    received,
    quoted,
    won,
    quotedRate: conversionRate(quoted, received),
    wonRate: conversionRate(won, quoted),
  };
}

export type RepRow = {
  userId: string;
  name: string;
  leads: number;
  sent: Bucket;
  accepted: Bucket;
  rate: number;
};

/**
 * How each person did within the period.
 *
 * Quotes are attributed to whoever wrote them and leads to whoever owns them,
 * which are not always the same person — so the columns are counted separately
 * rather than rolled into one "performance" number that would hide which is which.
 */
export async function repPerformance(ctx: CompanyContext, period: Period): Promise<RepRow[]> {
  const visible = visibilityWhere(ctx);
  const window = { gte: period.from, lt: period.to };

  const [sent, accepted, leads] = await Promise.all([
    ctx.db.quote.groupBy({
      by: ["createdById", "currency"],
      where: { ...visible, sentAt: window },
      _count: { _all: true },
      _sum: { total: true },
    }),
    ctx.db.quote.groupBy({
      by: ["createdById", "currency"],
      where: { ...visible, decidedAt: window, status: QuoteStatus.ACCEPTED },
      _count: { _all: true },
      _sum: { total: true },
    }),
    ctx.db.lead.groupBy({
      by: ["ownerId"],
      where: { createdAt: window, ownerId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const rows = new Map<string, RepRow>();
  const ensure = (id: string): RepRow => {
    const existing = rows.get(id);
    if (existing) return existing;
    const row: RepRow = {
      userId: id,
      name: id,
      leads: 0,
      sent: { ...EMPTY },
      accepted: { ...EMPTY },
      rate: 0,
    };
    rows.set(id, row);
    return row;
  };

  // Same rule as the breakdown: count every quote, value only the ones in the
  // company's currency. A rep gets one row per currency they quoted in, so the
  // figures accumulate instead of being assigned.
  const home = ctx.company.currency;
  for (const row of sent) {
    if (!row.createdById) continue;
    const rep = ensure(row.createdById);
    rep.sent.count += row._count._all;
    if (row.currency === home) rep.sent.value += Number(row._sum.total ?? 0);
  }
  for (const row of accepted) {
    if (!row.createdById) continue;
    const rep = ensure(row.createdById);
    rep.accepted.count += row._count._all;
    if (row.currency === home) rep.accepted.value += Number(row._sum.total ?? 0);
  }
  for (const row of leads) {
    if (!row.ownerId) continue;
    ensure(row.ownerId).leads = row._count._all;
  }

  if (rows.size === 0) return [];

  // `User` is a global model, so `ctx.db` doesn't bound it: the ids come from
  // rows this company could already see, which is what keeps this in bounds.
  const users = await ctx.db.user.findMany({
    where: { id: { in: [...rows.keys()] } },
    select: { id: true, name: true, email: true },
  });

  for (const user of users) {
    const row = rows.get(user.id);
    if (row) row.name = user.name ?? user.email;
  }

  for (const row of rows.values()) {
    row.rate = conversionRate(row.accepted.count, row.sent.count);
  }

  return [...rows.values()].sort((a, b) => b.accepted.value - a.accepted.value);
}

/**
 * The earliest year this company has anything to report on — across leads and
 * quotes, since a quote can exist with no lead behind it and a lead can exist
 * with no quote yet. A company with nothing at all gets the current year, so
 * the picker still has one sane option rather than an empty list.
 */
export async function firstReportYear(ctx: CompanyContext): Promise<number> {
  const [lead, quote] = await Promise.all([
    ctx.db.lead.aggregate({ _min: { createdAt: true } }),
    ctx.db.quote.aggregate({ _min: { createdAt: true } }),
  ]);

  const dates = [lead._min.createdAt, quote._min.createdAt].filter(
    (date): date is Date => date !== null,
  );
  if (dates.length === 0) return new Date().getFullYear();

  return Math.min(...dates.map((date) => date.getFullYear()));
}

export type Timing = {
  /** Median days from sending to the customer's answer, for what was decided. */
  medianToDecision: number | null;
  /** Median days the still-open quotes have been waiting. */
  medianWaiting: number | null;
  /** Open quotes that have been waiting longer than `staleAfterDays`. */
  stale: number;
  staleAfterDays: number;
};

/** Anything open for longer than this is worth chasing rather than waiting on. */
export const STALE_AFTER_DAYS = 14;

/**
 * How long the customer takes, and how long the open ones have been sitting.
 *
 * Reported as medians: one quote forgotten for eight months would drag a mean
 * far away from what the team actually experiences week to week.
 */
export async function decisionTiming(
  ctx: CompanyContext,
  period: Period,
  now: Date = new Date(),
): Promise<Timing> {
  const visible = visibilityWhere(ctx);

  const [decided, open] = await Promise.all([
    ctx.db.quote.findMany({
      where: {
        ...visible,
        decidedAt: { gte: period.from, lt: period.to },
        sentAt: { not: null },
      },
      select: { sentAt: true, decidedAt: true },
    }),
    ctx.db.quote.findMany({
      where: { ...visible, status: QuoteStatus.SENT, sentAt: { not: null, lt: period.to } },
      select: { sentAt: true },
    }),
  ]);

  const toDecision = decided
    .filter((quote) => quote.sentAt && quote.decidedAt)
    .map((quote) => daysBetween(quote.sentAt!, quote.decidedAt!));

  const waiting = open.map((quote) => daysBetween(quote.sentAt!, now));

  return {
    medianToDecision: median(toDecision),
    medianWaiting: median(waiting),
    stale: waiting.filter((days) => days > STALE_AFTER_DAYS).length,
    staleAfterDays: STALE_AFTER_DAYS,
  };
}

/** The period's time series, already bucketed with the rolling average applied. */
export async function quoteSeries(
  ctx: CompanyContext,
  period: Period,
  display: DisplayAs,
  rollingDays: number,
): Promise<SeriesPoint[]> {
  const quotes = await ctx.db.quote.findMany({
    where: {
      ...visibilityWhere(ctx),
      createdAt: { gte: period.from, lt: period.to },
      status: { not: QuoteStatus.DRAFT },
    },
    select: { createdAt: true, total: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const rows = quotes.map((quote) => ({
    at: quote.createdAt,
    value: Number(quote.total),
    accepted: quote.status === QuoteStatus.ACCEPTED,
  }));
  const roll = (series: SeriesPoint[]) =>
    rollingDays > 0 ? rollingSum(series, rollingDays) : series;

  if (display === "average") {
    // Summed and counted separately, rolled separately, divided last.
    const sums = roll(buildSeries(rows, period));
    const counts = roll(buildSeries(rows.map((row) => ({ ...row, value: 1 })), period));
    return divideSeries(sums, counts);
  }

  const values = display === "count" ? rows.map((row) => ({ ...row, value: 1 })) : rows;
  return roll(buildSeries(values, period));
}
