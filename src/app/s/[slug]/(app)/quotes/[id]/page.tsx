import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getQuote } from "@/modules/quotes/service";
import { listLeads } from "@/modules/leads/service";
import { listCompanyDocuments } from "@/modules/documents/service";
import { QuoteForm } from "@/modules/quotes/quote-form";
import { activeCatalogue } from "@/modules/catalogue/service";
import { QuoteActionsBar } from "@/modules/quotes/quote-actions-bar";
import {
  decideQuoteAction,
  resendQuoteAction,
  revokeShareAction,
  sendQuoteAction,
  updateQuoteAction,
} from "@/modules/quotes/actions";
import { ShareCard } from "@/modules/quotes/share-card";
import { QuoteReuseCard } from "@/modules/quote-templates/quote-actions";
import { isQuoteEditable, QUOTE_STATUS_CLASS } from "@/modules/quotes/constants";
import { currencyOptions } from "@/lib/intl/options";
import { EmailTemplateKind, MessageAuthor, PricingMode, QuoteStatus } from "@/generated/prisma/enums";
import { Celebrate } from "@/components/celebrate";
import { acceptedKey } from "@/lib/celebrate";
import { QuoteTracking } from "@/modules/quotes/quote-tracking";
import { AttachmentsManager } from "@/modules/quotes/attachments-manager";
import { MessageThread } from "@/modules/portal/message-thread";
import { formatThread } from "@/modules/portal/thread";
import { RichText } from "@/components/rich-text";
import { sendStaffMessageAction } from "@/modules/quotes/actions";
import { isViewingNow } from "@/modules/portal/share";
import { formatDateTime } from "@/lib/format";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { getTranslations as getT } from "next-intl/server";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCompanyContext();
  const [t, tCommon] = await Promise.all([
    getTranslations("quotes"),
    getTranslations("common"),
  ]);

  if (!can(ctx, "quotes.read")) notFound();

  const quote = await getQuote(ctx, id);
  if (!quote) notFound();

  const reference = formatQuoteNumber(ctx.company.quotePrefix, quote.number);
  // The currency comes from the quote, not the company: it's the copy frozen on issue.
  const money = (value: number) => formatMoney(value, quote.currency, ctx.company.formatLocale);
  const editable = isQuoteEditable(quote.status) && can(ctx, "quotes.update");

  const sendAction = sendQuoteAction.bind(null, quote.id);
  const decideAction = decideQuoteAction.bind(null, quote.id);
  const updateAction = updateQuoteAction.bind(null, quote.id);
  const resendAction = resendQuoteAction.bind(null, quote.id);
  const revokeAction = revokeShareAction.bind(null, quote.id);

  const [{ items: leads }, documents, catalogue] = editable
    ? await Promise.all([
        listLeads(ctx, { page: 1, discarded: false }),
        listCompanyDocuments(ctx),
        activeCatalogue(ctx),
      ])
    : [{ items: [] }, [], []];

  // Named because they appear in both arrangements below, and a copy in each
  // branch is how the two quietly drift apart.
  const reuseCard = <QuoteReuseCard quoteId={quote.id} canEdit={can(ctx, "quotes.create")} />;
  const attachmentsCard = (
    <AttachmentsManager
      quoteId={quote.id}
      attachments={quote.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        size: attachment.size,
      }))}
      canManage={editable}
      formatLocale={ctx.company.formatLocale}
    />
  );

  return (
    <div className="space-y-6">
      {/* The team is never watching when the customer accepts — they find out
          by email and open the quote later. So the celebration is tied to
          reading the news, not to the instant it happened. */}
      {quote.status === QuoteStatus.ACCEPTED ? (
        <Celebrate onceKey={acceptedKey.staff(quote.id)} />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/quotes" aria-label={t("backToQuotes")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{quote.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{reference}</span>
              <Badge variant="outline" className={QUOTE_STATUS_CLASS[quote.status]}>
                {t(`status.${quote.status}`)}
              </Badge>
              {quote.lead ? (
                <Link href={`/leads/${quote.lead.id}`} className="hover:underline">
                  · {quote.lead.title}
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <QuoteActionsBar
          quoteId={quote.id}
          status={quote.status}
          canSend={can(ctx, "quotes.send")}
          canDecide={can(ctx, "quotes.decide")}
          onSend={async () => {
            "use server";
            return sendAction();
          }}
          onDecide={async (decision) => {
            "use server";
            return decideAction(decision);
          }}
        />
      </div>

      {editable ? (
        <QuoteForm
          catalogue={catalogue.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            unit: item.unit,
            unitPrice: String(Number(item.unitPrice)),
          }))}
          action={updateAction}
          leads={leads.map((lead) => ({ id: lead.id, title: lead.title }))}
          documents={documents.map((doc) => ({ id: doc.id, name: doc.name }))}
          currency={ctx.company.currency}
          currencies={currencyOptions(await getLocale())}
          formatLocale={ctx.company.formatLocale}
          pricesIncludeTax={quote.pricesIncludeTax}
          taxLabel={t(`taxType.${quote.taxType}`)}
          submitLabel={tCommon("saveChanges")}
          defaults={{
            title: quote.title,
            pricingMode: quote.pricingMode,
            sections: quote.sections.map((section) => ({
              title: section.title,
              body: section.body ?? "",
              amount: String(Number(section.amount)),
            })),
            intro: quote.intro,
            exclusions: quote.exclusions,
            leadId: quote.leadId,
            termsDocumentId: quote.termsDocumentId,
            taxRate: Number(quote.taxRate),
            currency: quote.currency,
            discount: Number(quote.discount),
            validUntil: quote.validUntil?.toISOString().slice(0, 10) ?? null,
            notes: quote.notes,
            terms: quote.terms,
            items: quote.items.map((item) => ({
              description: item.description,
              quantity: String(Number(item.quantity)),
              unitPrice: String(Number(item.unitPrice)),
              discount: String(Number(item.discount)),
            })),
          }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("detail")}</CardTitle>
            </CardHeader>

            {quote.pricingMode === PricingMode.SECTIONS ? (
              <CardContent className="space-y-5">
                {quote.sections.map((section) => (
                  <div key={section.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="font-semibold">{section.title}</h3>
                      <span className="tabular-nums">{money(Number(section.amount))}</span>
                    </div>
                    <RichText className="text-sm text-muted-foreground" html={section.body} />
                  </div>
                ))}
              </CardContent>
            ) : (
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.description")}</TableHead>
                    <TableHead className="text-right">{t("columns.quantity")}</TableHead>
                    <TableHead className="text-right">{t("columns.unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("columns.discount")}</TableHead>
                    <TableHead className="text-right">{t("columns.total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(item.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(Number(item.unitPrice))}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(item.discount)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{money(Number(item.total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            )}
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">{t("form.totals")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1.5 text-sm">
                <Row label={t("form.subtotal")} value={money(Number(quote.subtotal))} />
                <Row label={t("form.discount")} value={`− ${money(Number(quote.discount))}`} />
                <Row label={`${t(`taxType.${quote.taxType}`)} (${Number(quote.taxRate)}%)`} value={money(Number(quote.taxAmount))} />
                <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                  <dt>{t("form.total")}</dt>
                  <dd className="tabular-nums">{money(Number(quote.total))}</dd>
                </div>
              </dl>

              {quote.validUntil ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("validUntilDate", {
                    date: formatDate(
                      quote.validUntil,
                      ctx.company.formatLocale,
                      ctx.company.timezone,
                    ),
                  })}
                </p>
              ) : null}

              {quote.notes ? (
                <p className="mt-4 text-sm whitespace-pre-wrap">{quote.notes}</p>
              ) : null}
              {quote.terms ? (
                <p className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{quote.terms}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {/**
        * Two rows, and the split is by what the card is for rather than by how
        * tall it happens to be. The first row is everything you *do* with the
        * quote once it has gone out — reuse it, mind its link, see whether it
        * was opened. The second is the conversation, with what the customer
        * left behind stacked beside it.
        *
        * Without a share link there is no link to mind and no activity to show,
        * so the two cards that always exist go full width instead of sitting in
        * a third of a row with nothing beside them.
        */}
      {quote.share ? (
        <>
          {/* No `items-start` here, unlike the row below: letting the grid
              stretch them is what gives the three the same height, and they
              read as one band of controls rather than three loose cards. */}
          <div className="grid gap-6 lg:grid-cols-3">
            {reuseCard}

            <ShareCard
              revoked={quote.share.revokedAt !== null}
              expiresLabel={
                quote.share.expiresAt
                  ? formatDate(
                      quote.share.expiresAt,
                      ctx.company.formatLocale,
                      ctx.company.timezone,
                    )
                  : null
              }
              previewHref={`/quotes/${quote.id}/preview`}
              canManage={can(ctx, "quotes.send")}
              onResend={async () => {
                "use server";
                return resendAction();
              }}
              onRevoke={async () => {
                "use server";
                return revokeAction();
              }}
            />

            <QuoteTracking
              quoteId={quote.id}
              initial={{
                shared: true,
                viewingNow: isViewingNow(quote.share.lastSeenAt),
                openCount: quote.share.openCount,
                lastSeenAt: quote.share.lastSeenAt?.toISOString() ?? null,
              }}
              formatLocale={ctx.company.formatLocale}
              timezone={ctx.company.timezone}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              {attachmentsCard}

              <QuoteEvents
                events={quote.events}
                formatLocale={ctx.company.formatLocale}
                timezone={ctx.company.timezone}
              />

              <QuoteEmails
                emails={quote.emailsSent}
                formatLocale={ctx.company.formatLocale}
                timezone={ctx.company.timezone}
              />

              {quote.acceptance ? (
                <AcceptanceCard
                  acceptance={quote.acceptance}
                  formatLocale={ctx.company.formatLocale}
                  timezone={ctx.company.timezone}
                />
              ) : null}
            </div>

            <div className="lg:col-span-2">
              <MessageThread
                messages={formatThread(quote.messages, {
                  formatLocale: ctx.company.formatLocale,
                  timezone: ctx.company.timezone,
                  withAuthorNames: true,
                })}
                side={MessageAuthor.STAFF}
                companyName={ctx.company.name}
                action={sendStaffMessageAction.bind(null, quote.id)}
                feedUrl={`/api/quotes/${quote.id}/messages`}
              />
            </div>
          </div>
        </>
      ) : (
        /*
          No customer link yet, so there is no row of things to do with one.
          Side by side rather than stacked full width: each card holds a short
          list, and at full width a two-line card leaves a band of empty card
          under it.
        */
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {attachmentsCard}
          {reuseCard}
        </div>
      )}
    </div>
  );
}

/** A log of what the customer did with the quote. */
/**
 * What the company has sent this customer about this quote.
 *
 * The same rows that keep the nightly sweep from chasing somebody twice, shown
 * where they answer a question nobody could answer before: has this customer
 * already been followed up, and when. Without it the only way to know was to
 * remember.
 */
async function QuoteEmails({
  emails,
  formatLocale,
  timezone,
}: {
  emails: Array<{ id: string; kind: EmailTemplateKind; sentAt: Date }>;
  formatLocale: string;
  timezone: string;
}) {
  if (emails.length === 0) return null;
  const t = await getT("emailTemplates");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("sentTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm">
          {emails.map((email) => (
            <li key={email.id} className="flex flex-wrap justify-between gap-2">
              <span>{t(`kinds.${email.kind}.name`)}</span>
              <span className="text-muted-foreground">
                {formatDateTime(email.sentAt, formatLocale, timezone)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

async function QuoteEvents({
  events,
  formatLocale,
  timezone,
}: {
  events: Array<{ id: string; type: string; createdAt: Date }>;
  formatLocale: string;
  timezone: string;
}) {
  const t = await getT("quotes.tracking");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("events")}</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-2">
                <span>{t(`eventTypes.${event.type}`)}</span>
                <time
                  dateTime={event.createdAt.toISOString()}
                  className="text-xs text-muted-foreground tabular-nums"
                >
                  {formatDateTime(event.createdAt, formatLocale, timezone)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** The backing for the acceptance: who, what text they accepted, and with what signature. */
async function AcceptanceCard({
  acceptance,
  formatLocale,
  timezone,
}: {
  acceptance: {
    acceptedByName: string;
    acceptedByEmail: string | null;
    statementText: string;
    signatureType: string;
    signatureData: string | null;
    additionalComments: string | null;
    orderReference: string | null;
    ipAddress: string | null;
    acceptedAt: Date;
  };
  formatLocale: string;
  timezone: string;
}) {
  const t = await getT("quotes.tracking");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {t("acceptedBy", { name: acceptance.acceptedByName })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {formatDateTime(acceptance.acceptedAt, formatLocale, timezone)}
          {acceptance.acceptedByEmail ? ` · ${acceptance.acceptedByEmail}` : ""}
          {acceptance.ipAddress ? ` · ${acceptance.ipAddress}` : ""}
        </p>

        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("acceptanceStatement")}
          </p>
          <p className="rounded-md bg-muted/50 p-2 text-xs">{acceptance.statementText}</p>
        </div>

        {acceptance.signatureData && acceptance.signatureType === "DRAWN" ? (
          <svg viewBox="0 0 600 130" className="h-20 w-full" role="img" aria-label={t("signature")}>
            <path
              d={acceptance.signatureData}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}

        {acceptance.signatureData && acceptance.signatureType === "TYPED" ? (
          <p className="font-serif text-xl italic">{acceptance.signatureData}</p>
        ) : null}

        {acceptance.orderReference ? (
          <p className="text-xs">
            {t("orderReference", { reference: acceptance.orderReference })}
          </p>
        ) : null}

        {acceptance.additionalComments ? (
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("comments")}
            </p>
            <p className="text-xs whitespace-pre-wrap">{acceptance.additionalComments}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
