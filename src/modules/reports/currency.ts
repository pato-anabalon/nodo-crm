/**
 * Folding grouped rows down to one figure when the rows may be in several
 * currencies.
 *
 * Pure on purpose, like `metrics.ts`: the rule it encodes is the kind that is
 * easy to get quietly wrong and impossible to notice afterwards, and it should
 * be checkable without a database or a session.
 */

export type Bucket = { count: number; value: number };

/** One `groupBy` row, whatever else that groupBy was keyed on. */
export type CurrencyRow = {
  currency: string;
  _count: { _all: number };
  _sum: { total: unknown };
};

/**
 * Amounts only add up inside one currency; counts add up across all of them.
 * "We sent eleven quotes" is true whatever they were priced in, but summing
 * NZD and AUD into one total produces a number that means nothing and looks
 * exactly like one that does.
 *
 * So every figure counts every quote and values only the ones in the company's
 * own currency — and `foreign` says how many were left out of the money, because
 * a silently smaller total is the one kind of wrong nobody can spot.
 */
export function foldByCurrency(
  rows: CurrencyRow[],
  home: string,
): { bucket: Bucket; foreign: number } {
  let count = 0;
  let value = 0;
  let foreign = 0;

  for (const row of rows) {
    count += row._count._all;
    if (row.currency === home) value += Number(row._sum.total ?? 0);
    else foreign += row._count._all;
  }

  return { bucket: { count, value }, foreign };
}
