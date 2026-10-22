import { unstable_cache } from "next/cache";
import type { CompanyContext } from "@/lib/auth/session";
import { forCompany } from "@/lib/db/tenant";
import { visibilityWhere } from "./service";
import { yearBounds, yearOf, type ExportableQuote } from "./export";

/** Rows read at a time. The file is written as it goes, so memory never holds a whole year. */
export const EXPORT_BATCH_SIZE = 500;

/** A day: past years only change when somebody imports history, which is rare and deliberate. */
const PAST_YEARS_TTL_SECONDS = 60 * 60 * 24;

/**
 * Which years a company has quotes in, up to but not including the current one.
 *
 * That is the part that doesn't move: a quote is stamped when it is made, so the
 * only way a past year gains one is an import of history. It is cached for a day
 * per company and per who is asking (somebody who sees only their own quotes has
 * a shorter list than somebody who sees all of them).
 *
 * Inside a cache there is no session to read, so it takes plain values and goes
 * through `forCompany` — the same tenant filter `ctx.db` is, built from the id.
 * `unstable_cache` and not `use cache`: the latter means turning on Cache
 * Components for the whole app, which is a decision about every page rather than
 * about this list.
 */
const pastYears = unstable_cache(
  async (companyId: string, ownerId: string | null, timeZone: string, currentYear: number): Promise<number[]> => {
    const db = forCompany(companyId);
    const mine = ownerId ? { createdById: ownerId } : {};
    const before = { createdAt: { lt: yearBounds(currentYear, timeZone).from } };

    const [first, last] = await Promise.all([
      db.quote.findFirst({ where: { ...mine, ...before }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      db.quote.findFirst({ where: { ...mine, ...before }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    if (!first || !last) return [];

    const from = yearOf(first.createdAt, timeZone);
    const to = yearOf(last.createdAt, timeZone);

    // Only the years in between that actually have something: an empty year in
    // the list would hand somebody a file with a header and nothing else.
    const candidates = Array.from({ length: to - from + 1 }, (_, index) => from + index);
    const present = await Promise.all(
      candidates.map(async (year) => {
        const { from: start, to: end } = yearBounds(year, timeZone);
        const found = await db.quote.findFirst({
          where: { ...mine, createdAt: { gte: start, lt: end } },
          select: { id: true },
        });
        return found ? year : null;
      }),
    );

    return present.filter((year): year is number => year !== null);
  },
  ["quote-export-years"],
  { revalidate: PAST_YEARS_TTL_SECONDS },
);

/**
 * The years offered to export, most recent first. There is deliberately no "all":
 * a company that brought in thousands of quotes would otherwise be one click away
 * from reading every one of them in a single request.
 *
 * The current year is asked live — quotes are being made in it — and the rest
 * comes from the cache.
 */
export async function quoteYears(ctx: CompanyContext): Promise<number[]> {
  const timeZone = ctx.company.timezone;
  const currentYear = yearOf(new Date(), timeZone);
  const ownerId = ctx.permissions.has("quotes.read.all") ? null : ctx.user.id;

  const { from, to } = yearBounds(currentYear, timeZone);
  const [past, thisYear] = await Promise.all([
    pastYears(ctx.company.id, ownerId, timeZone, currentYear),
    ctx.db.quote.findFirst({
      where: { ...visibilityWhere(ctx), createdAt: { gte: from, lt: to } },
      select: { id: true },
    }),
  ]);

  return [...(thisYear ? [currentYear] : []), ...[...past].sort((a, b) => b - a)];
}

/**
 * One year of quotes the person may see, in batches, oldest first.
 *
 * Keyset on the quote number rather than `skip`: every batch is an index range
 * read, not a count-and-discard of everything before it. Amounts are selected
 * only when the profile may see them, so the database isn't even asked for what
 * the file mustn't contain.
 */
export async function* exportQuoteBatches(
  ctx: CompanyContext,
  year: number,
  canSeeAmounts: boolean,
): AsyncGenerator<ExportableQuote[]> {
  const { from, to } = yearBounds(year, ctx.company.timezone);
  let after = 0;

  while (true) {
    const batch: ExportableQuote[] = await ctx.db.quote.findMany({
      where: { ...visibilityWhere(ctx), createdAt: { gte: from, lt: to }, number: { gt: after } },
      orderBy: { number: "asc" },
      take: EXPORT_BATCH_SIZE,
      select: {
        number: true,
        title: true,
        status: true,
        clientName: true,
        clientCompanyName: true,
        clientEmail: true,
        clientPhone: true,
        createdAt: true,
        sentAt: true,
        decidedAt: true,
        validUntil: true,
        currency: true,
        share: { select: { openCount: true } },
        ...(canSeeAmounts ? { subtotal: true, discount: true, taxAmount: true, taxDisplayMode: true, total: true } : {}),
      },
    });

    if (batch.length === 0) return;
    yield batch;
    if (batch.length < EXPORT_BATCH_SIZE) return;
    after = batch[batch.length - 1].number;
  }
}
