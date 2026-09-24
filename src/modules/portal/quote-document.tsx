import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { CheckCircle2, FileText, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageAuthor,
  PricingMode,
  QuoteStatus,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n/config";
import { formatDateTime, formatMoney } from "@/lib/format";
import { RichText } from "@/components/rich-text";
import { PrintButton } from "./print-button";
import { PresenceHeartbeat } from "./heartbeat";
import { QuoteHeader } from "./quote-header";
import { CompanyReviews } from "./company-reviews";
import { AcceptPanel } from "./accept-panel";
import { Celebrate } from "@/components/celebrate";
import { acceptedKey } from "@/lib/celebrate";
import { MessageThread } from "./message-thread";
import { formatThread } from "./thread";
import {
  canClientRespond,
  companyDocumentSelect,
  quoteDocumentInclude,
} from "./service";
import {
  acceptQuoteAction,
  declineQuoteAction,
  sendClientMessageAction,
} from "./actions";

type DocumentCompany = Prisma.CompanyGetPayload<{
  select: typeof companyDocumentSelect;
}>;
type DocumentQuote = Prisma.QuoteGetPayload<{
  include: typeof quoteDocumentInclude;
}>;

/**
 * The quote as the end customer reads it.
 *
 * Rendered from two places: the customer's link, and the company's own preview.
 * They share this component rather than a copy of it, because a preview that
 * drifts from the real page is worse than no preview at all.
 *
 * `token` is what separates them. With one, the page is live: it beats to say
 * someone is looking, and it can be answered. Without one, it is a preview, and
 * everything that would write something — the heartbeat, the acceptance, the
 * thread's reply box — is left out rather than shown dead. Previewing must not
 * tell the panel that the customer is viewing, nor count as an opening.
 *
 * The order follows a tradesperson's quote: who is quoting and to whom, the work
 * with its price, the attachments, the conditions, and only then the
 * conversation and the references.
 */
export async function QuoteDocument({
  company,
  quote,
  locale,
  token,
}: {
  company: DocumentCompany;
  quote: DocumentQuote;
  locale: Locale;
  token: string | null;
}) {
  const [t, allMessages] = await Promise.all([
    getTranslations({ locale, namespace: "portal" }),
    getMessages({ locale }),
  ]);

  const money = (value: number) =>
    formatMoney(value, quote.currency, company.formatLocale);
  const live = token !== null;
  const open = live && canClientRespond(quote.status);
  const taxLabel = quote.taxType;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ portal: (allMessages as Record<string, unknown>).portal }}
    >
      {token ? <PresenceHeartbeat token={token} /> : null}

      {/*
        The watermark hangs 125px past the document's right edge, which is the
        look; without something clipping it, those 125px also widen the page and
        the customer gets a horizontal scrollbar on any screen narrower than
        about 1150px. This box is the width of what is available, so the bleed
        shows wherever it fits and is cut where it doesn't.

        `clip` rather than `hidden`: `hidden` would make this a scroll container,
        and a scroll container is how `position: sticky` inside it stops working.
      */}
      <div className="overflow-x-clip">
        <main className="quote-document mx-auto w-full max-w-4xl space-y-8 px-6 py-10 pb-28">
          <QuoteHeader
            company={company}
            issuer={quote.createdBy}
            client={{
              companyName: quote.clientCompanyName,
              name: quote.clientName,
              email: quote.clientEmail,
              phone: quote.clientPhone,
            }}
            quote={quote}
            locale={locale}
            printButton={<PrintButton label={t("downloadPdf")} />}
          />

          {/* Only for the customer: `token` is null in the team's own preview,
              and a company throwing confetti at itself for its own quote is not
              a celebration. Accepting unmounts the panel it was done in, so the
              state is the only thing left to hang this on.

              The key says `customer` because the portal and the dashboard are the
              same origin — the customer sees the company's own subdomain, which
              is the whole point — and therefore share one `localStorage`. With a
              single key, a customer accepting spent the team's celebration too. */}
          {quote.status === QuoteStatus.ACCEPTED && token ? (
            <Celebrate onceKey={acceptedKey.customer(quote.id)} />
          ) : null}

          {quote.status === QuoteStatus.ACCEPTED && quote.acceptance ? (
            <Banner icon="accepted">
              {t("accepted", {
                date: formatDateTime(
                  quote.acceptance.acceptedAt,
                  company.formatLocale,
                  company.timezone,
                ),
              })}
            </Banner>
          ) : null}

          {quote.status === QuoteStatus.REJECTED ? (
            <Banner icon="declined">
              {t("declined", {
                date: quote.decidedAt
                  ? formatDateTime(
                      quote.decidedAt,
                      company.formatLocale,
                      company.timezone,
                    )
                  : "",
              })}
            </Banner>
          ) : null}

          <section className="space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {quote.title}
            </h1>

            {quote.intro ? (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {quote.intro}
              </p>
            ) : null}

            {quote.pricingMode === PricingMode.SECTIONS ? (
              <div className="space-y-8 border-t pt-6">
                {quote.sections.map((section) => (
                  <article key={section.id} className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      <h2 className="text-lg font-semibold">{section.title}</h2>
                      <span className="text-lg tabular-nums">
                        {money(Number(section.amount))}
                      </span>
                    </div>
                    <RichText
                      className="text-sm text-muted-foreground"
                      html={section.body}
                    />
                  </article>
                ))}
              </div>
            ) : (
              <div className="space-y-3 border-t pt-6">
                {quote.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-baseline justify-between gap-4"
                  >
                    <span className="min-w-0 flex-1 text-sm">
                      {item.description}
                      <span className="text-muted-foreground">
                        {" "}
                        × {Number(item.quantity)}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {money(Number(item.total))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {quote.attachments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium tracking-wide text-[var(--brand-ink)] uppercase">
                  {t("attachments")}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {quote.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="size-4" />
                          {attachment.name}
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* The breakdown always shows all three, whichever base was chosen. */}
            <dl className="ml-auto max-w-xs space-y-1.5 border-t pt-4 text-sm">
              <Row
                label={t("subtotal")}
                value={money(Number(quote.subtotal))}
              />
              {Number(quote.discount) > 0 ? (
                <Row
                  label={t("discount")}
                  value={`− ${money(Number(quote.discount))}`}
                />
              ) : null}
              <Row
                label={`${taxLabel} ${Number(quote.taxRate)}%`}
                value={money(Number(quote.taxAmount))}
              />
              <div className="flex items-baseline justify-between gap-3 border-t pt-2 text-base font-semibold">
                <dt>
                  {quote.pricesIncludeTax
                    ? t("totalIncluding", {
                        currency: quote.currency,
                        tax: taxLabel,
                      })
                    : t("totalExcluding", {
                        currency: quote.currency,
                        tax: taxLabel,
                      })}
                </dt>
                <dd className="tabular-nums">{money(Number(quote.total))}</dd>
              </div>
            </dl>
          </section>

          {quote.notes ||
          quote.exclusions ||
          quote.terms ||
          quote.termsDocument ? (
            <section className="space-y-6 border-t pt-8 text-sm">
              {quote.notes ? (
                <Block title={t("notes")}>{quote.notes}</Block>
              ) : null}

              {quote.terms ? (
                <Block title={t("termsOfQuotation")}>{quote.terms}</Block>
              ) : null}

              {quote.termsDocument ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={quote.termsDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="size-4" />
                    {quote.termsDocument.name}
                  </a>
                </Button>
              ) : null}

              {quote.exclusions ? (
                <Block title={t("exclusions")}>{quote.exclusions}</Block>
              ) : null}
            </section>
          ) : null}

          {open && token ? (
            <section id="accept" className="no-print scroll-mt-6 border-t pt-8">
              <AcceptPanel
                settings={{
                  mode: company.acceptanceMode,
                  statement: company.acceptanceStatement,
                  requireSignature: company.requireSignature,
                  askAdditionalComments: company.askAdditionalComments,
                  askOrderReference: company.askOrderReference,
                }}
                acceptAction={acceptQuoteAction.bind(null, token)}
                declineAction={declineQuoteAction.bind(null, token)}
              />
            </section>
          ) : null}

          {token ? (
            <section className="no-print border-t pt-8">
              <h2 className="mb-4 text-lg font-semibold">
                {t("questionsAndAnswers")}
              </h2>
              <MessageThread
                messages={formatThread(quote.messages, {
                  formatLocale: company.formatLocale,
                  timezone: company.timezone,
                  withAuthorNames: false,
                })}
                side={MessageAuthor.CLIENT}
                companyName={company.name}
                action={sendClientMessageAction.bind(null, token)}
                feedUrl={`/api/q/${encodeURIComponent(token)}/messages`}
              />
            </section>
          ) : null}

          {/*
            The reviews, with the company's mark behind them.

            Both are positioned and the image comes first, so the reviews paint on
            top without anybody having to reason about z-index — the moment a
            stacking context appears above this, a negative z-index would slide
            the mark behind the page instead.

            `min-h` is what keeps it from escaping upward over the message thread
            when a company has a watermark and no reviews yet: the box has to be
            at least as tall as the thing floating in it.

            It carries no `no-print` on purpose — appearing on the printed quote is
            most of what a watermark is for. And it is decoration as far as a
            screen reader is concerned: the company is named all over the document
            already, so reading its mark out again at the end says nothing.
          */}
          {company.watermarkUrl ? (
            <div className="relative min-h-70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={company.watermarkUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -right-[125px] -bottom-[90px] max-h-125 w-125 object-contain opacity-15"
              />

              <div className="relative">
                <CompanyReviews reviews={company.reviews} locale={locale} />
              </div>
            </div>
          ) : (
            <CompanyReviews reviews={company.reviews} locale={locale} />
          )}
        </main>
      </div>

      {/* The total and the button follow the view: without this, the customer has
          to get past the legal exclusions to find how to accept. */}
      {open ? (
        <div className="no-print fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <span className="text-sm">
              <span className="text-muted-foreground">
                {quote.pricesIncludeTax
                  ? t("totalIncluding", {
                      currency: quote.currency,
                      tax: taxLabel,
                    })
                  : t("totalExcluding", {
                      currency: quote.currency,
                      tax: taxLabel,
                    })}
              </span>{" "}
              <span className="text-base font-semibold tabular-nums">
                {money(Number(quote.total))}
              </span>
            </span>
            <Button asChild>
              <a href="#accept">{t("accept")}</a>
            </Button>
          </div>
        </div>
      ) : null}
    </NextIntlClientProvider>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h2 className="font-semibold">{title}</h2>
      <p className="whitespace-pre-wrap text-muted-foreground">{children}</p>
    </div>
  );
}

function Banner({
  icon,
  children,
}: {
  icon: "accepted" | "declined";
  children: React.ReactNode;
}) {
  const accepted = icon === "accepted";
  return (
    <Card className={accepted ? "border-primary" : undefined}>
      <CardContent className="flex items-center gap-3">
        {accepted ? (
          <CheckCircle2 className="size-5 shrink-0 text-primary" />
        ) : (
          <XCircle className="size-5 shrink-0 text-muted-foreground" />
        )}
        <p className="text-sm">{children}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
