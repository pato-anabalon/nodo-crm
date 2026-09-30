import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  OpenCount,
  QuotePresenceProvider,
  QuoteSeen,
} from "@/modules/quotes/quote-presence";
import { QuoteRowActions } from "@/modules/quotes/row-actions";
import { elapsedLabel } from "@/lib/elapsed-label";
import { isViewingNow } from "@/modules/portal/share";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { quoteFiltersSchema } from "@/modules/quotes/schemas";
import { listQuotes } from "@/modules/quotes/service";
import {
  QUOTE_SECTIONS,
  QUOTE_STATUSES,
  isQuoteSection,
  QUOTE_STATUS_TEXT_CLASS,
} from "@/modules/quotes/constants";
import { formatMoney, formatQuoteNumber, truncate } from "@/lib/format";
import { HiddenAmount } from "@/modules/quotes/hidden-amount";

export async function generateMetadata() {
  const t = await getTranslations("quotes");
  return { title: t("title") };
}

/** How much of a title a row shows before it starts eliding. */
const TITLE_MAX = 50;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompanyContext();
  const [t, tCommon, tElapsed] = await Promise.all([
    getTranslations("quotes"),
    getTranslations("common"),
    getTranslations("common.elapsed"),
  ]);

  /** The company's own formats; the phrase is written here, not in the client. */
  const ago = (date: Date) =>
    elapsedLabel(date, tElapsed, ctx.company.formatLocale, ctx.company.timezone);

  if (!can(ctx, "quotes.read")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const canSeeAmounts = can(ctx, "quotes.read.amounts");

  const raw = await searchParams;
  const filters = quoteFiltersSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" && raw.status !== "" ? raw.status : undefined,
    section: isQuoteSection(typeof raw.section === "string" ? raw.section : undefined)
      ? raw.section
      : "all",
    page: typeof raw.page === "string" ? raw.page : 1,
  });

  const { items, total, page, pageCount } = await listQuotes(ctx, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("count", { count: total })}</p>
        </div>

        {can(ctx, "quotes.create") ? (
          <Button asChild>
            <Link href="/quotes/new">
              <Plus className="size-4" />
              {t("new")}
            </Link>
          </Button>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-1 border-b">
        {QUOTE_SECTIONS.map((section) => {
          const active = filters.section === section;
          return (
            <Link
              key={section}
              href={section === "all" ? "/quotes" : `/quotes?section=${section}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`sections.${section}`)}
            </Link>
          );
        })}
      </nav>

      <form className="flex flex-wrap gap-2">
        {filters.section !== "all" ? (
          <input type="hidden" name="section" value={filters.section} />
        ) : null}
        <Input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        <NativeSelect
          name="status"
          defaultValue={filters.status ?? ""}
          className="w-auto"
          placeholder={tCommon("allStatuses")}
          options={QUOTE_STATUSES.map((status) => ({
            value: status,
            label: t(`status.${status}`),
          }))}
        />
        <Button type="submit" variant="secondary">
          {tCommon("filter")}
        </Button>
      </form>

      <QuotePresenceProvider
        initial={Object.fromEntries(
          items
            .filter((quote) => quote.share)
            .map((quote) => [
              quote.id,
              {
                viewingNow: isViewingNow(quote.share!),
                openCount: quote.share!.openCount,
              },
            ]),
        )}
      >
        <TableCard>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.quote")}</TableHead>
                <TableHead>{t("columns.customer")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.sent")}</TableHead>
                <TableHead className="text-right">{t("columns.opens")}</TableHead>
                <TableHead className="text-right">{t("columns.total")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((quote) => (
                  <TableRow key={quote.id}>
                    {/*
                      The row has a subject. The title carries it and the
                      reference sits under it — which frees a column and gives
                      the row two lines to breathe. Everything else on the row
                      is an attribute of this, and reads quieter.
                    */}
                    <TableCell>
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="font-medium hover:underline"
                        // The whole title is still one hover away.
                        title={quote.title}
                      >
                        {truncate(quote.title, TITLE_MAX)}
                      </Link>
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {formatQuoteNumber(ctx.company.quotePrefix, quote.number)}
                      </div>
                    </TableCell>

                    <TableCell>
                      {quote.clientName ? <div>{quote.clientName}</div> : null}
                      {/*
                        Most quotes have no company — a person who enquired on
                        their own account. The row has to read well without it,
                        which is the ordinary case rather than the exception.
                      */}
                      {quote.clientCompanyName ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {quote.clientCompanyName}
                        </div>
                      ) : null}
                      {!quote.clientName && !quote.clientCompanyName ? (
                        <span className="text-muted-foreground">{tCommon("none")}</span>
                      ) : null}
                    </TableCell>

                    <TableCell>
                      <div className={`font-medium ${QUOTE_STATUS_TEXT_CLASS[quote.status]}`}>
                        {t(`status.${quote.status}`)}
                      </div>
                      <div className="mt-0.5 text-xs">
                        <QuoteSeen
                          quoteId={quote.id}
                          seenLabel={quote.share?.lastSeenAt ? ago(quote.share.lastSeenAt) : null}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {quote.sentAt
                        ? ago(quote.sentAt)
                        : "—"}
                    </TableCell>

                    <TableCell className="text-right text-sm">
                      <OpenCount quoteId={quote.id} />
                    </TableCell>

                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {canSeeAmounts ? (
                        formatMoney(Number(quote.total), quote.currency, ctx.company.formatLocale)
                      ) : (
                        <HiddenAmount />
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <QuoteRowActions quoteId={quote.id} title={quote.title} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
        </TableCard>
      </QuotePresenceProvider>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {tCommon("pageOf", { page, total: pageCount })}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(filters.section, page - 1)}>{tCommon("previous")}</Link>
              </Button>
            ) : null}
            {page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(filters.section, page + 1)}>{tCommon("next")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function pageHref(section: string, page: number): string {
  const params = new URLSearchParams();
  if (section !== "all") params.set("section", section);
  params.set("page", String(page));
  return `/quotes?${params.toString()}`;
}
