import { getTranslations } from "next-intl/server";
import { CompanyLogo } from "@/components/company-logo";
import { RichText } from "@/components/rich-text";
import { formatDate, formatDateTime, formatQuoteNumber } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export type HeaderCompany = {
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  logoUrl: string | null;
  quotePrefix: string;
  formatLocale: string;
  timezone: string;
};

export type HeaderIssuer = {
  name: string | null;
  jobTitle: string | null;
  phone: string | null;
} | null;

export type HeaderClient = {
  companyName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type HeaderQuote = {
  number: number;
  sentAt: Date | null;
  createdAt: Date;
  validUntil: Date | null;
  title: string;
  /** Already the frozen label text — "Estimate For", or whatever the company
   * called it — never a key to translate. Null for a quote created before
   * the company had any type configured. */
  quoteType: string | null;
  projectAddress: string | null;
  scope: string | null;
};

/**
 * The document header: who is quoting, to whom, and the document's details.
 *
 * FROM and FOR come first, as a matched pair of brand-tinted cards — the
 * parties to the document, read before the document itself. Everything about
 * *this* document — its type, its title, its number and dates, where the work
 * happens, what it covers — sits together below a divider, as one subject
 * rather than a third box competing with the two parties for space.
 */
export async function QuoteHeader({
  company,
  issuer,
  client,
  quote,
  locale,
  printButton,
}: {
  company: HeaderCompany;
  issuer: HeaderIssuer;
  client: HeaderClient;
  quote: HeaderQuote;
  locale: Locale;
  printButton?: React.ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "portal" });
  const reference = formatQuoteNumber(company.quotePrefix, quote.number);

  return (
    <header className="space-y-8 border-b pb-8">
      {/* The document's own identity sits opposite the logo — who issued it
          on one side, which one this is on the other — rather than buried
          below the title where it used to compete with the scope of work
          for attention. */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="xl" />

        <div className="text-right">
          <Field label={t("quoteNumber")}>
            <Line>{reference}</Line>
          </Field>
          <Field label={t("date")}>
            <Line>
              {formatDate(
                quote.sentAt ?? quote.createdAt,
                company.formatLocale,
                company.timezone,
              )}
            </Line>
          </Field>
          {quote.validUntil ? (
            <Field label={t("expiryDate")}>
              <Line>
                {formatDateTime(
                  quote.validUntil,
                  company.formatLocale,
                  company.timezone,
                )}
              </Line>
            </Field>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PartyCard label={t("from")}>
          {issuer?.name ? (
            <Line>
              <Strong>{issuer.name}</Strong>
            </Line>
          ) : null}
          {issuer?.jobTitle ? <Line>{issuer.jobTitle}</Line> : null}

          <div className="pt-2">
            <Strong>{company.legalName ?? company.name}</Strong>
            {company.address ? <Line>{company.address}</Line> : null}
            {company.website ? <Line>{company.website}</Line> : null}
          </div>

          {company.phone ? (
            <Field label={t("phone")}>
              <Line>{company.phone}</Line>
            </Field>
          ) : null}

          {company.taxId ? (
            <Field label={t("gstNumber")}>
              <Line>{company.taxId}</Line>
            </Field>
          ) : null}
        </PartyCard>

        <PartyCard label={t("for")}>
          {/* Whichever identifies the customer goes bold — most quotes have no
              client company, so the person's own name carries it instead. */}
          {client.companyName ? (
            <Strong>{client.companyName}</Strong>
          ) : client.name ? (
            <Strong>{client.name}</Strong>
          ) : null}

          {client.name && client.companyName ? (
            <Field label={t("to")}>
              <Line>{client.name}</Line>
            </Field>
          ) : null}

          {client.email ? (
            <Field label={t("email")}>
              <Line>{client.email}</Line>
            </Field>
          ) : null}

          {client.phone ? (
            <Field label={t("mobile")}>
              <Line>{client.phone}</Line>
            </Field>
          ) : null}
        </PartyCard>
      </div>

      <hr className="border-t" />

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {quote.quoteType ? `${quote.quoteType}: ` : ""}
            {quote.title}
          </h1>

          {quote.projectAddress ? (
            <Field label={t("projectAddress")}>
              <Line>{quote.projectAddress}</Line>
            </Field>
          ) : null}

          {quote.scope ? (
            <div className="space-y-1 pt-1">
              <Label>{t("scope")}</Label>
              <RichText
                className="text-sm text-muted-foreground"
                html={quote.scope}
              />
            </div>
          ) : null}
        </div>

        {printButton ? <div className="shrink-0">{printButton}</div> : null}
      </div>
    </header>
  );
}

/**
 * FROM and FOR, matched: rounded corners and a wash of the company's own
 * brand colour (`--primary`, not a solid fill — the text underneath still
 * has to read). `Label` inside keeps `--brand-ink`, the colour chosen to work
 * as text rather than as a fill — the two tokens solve different problems and
 * neither substitutes for the other.
 */
function PartyCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-primary/20 bg-muted-foreground/5 p-4 text-sm">
      <Label>
        <Strong>{label}</Strong>
      </Label>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/*
 * The field names carry the company's colour.
 *
 * They are labels rather than content — FROM, PHONE, GST NUMBER — so tinting
 * them brands the document without touching a single figure the customer has
 * to read. The value underneath keeps its own colour, which is what preserves
 * the contrast that matters.
 */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-wide text-[var(--brand-ink)] uppercase">
      {children}
    </p>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  // `<strong>`, not `<p>`: this is nested inside `Label` and `Line` in a
  // couple of spots (the party card's own title, the issuer's name), and a
  // `<p>` can't legally contain another one — the browser silently closes
  // the outer one, which is what a hydration mismatch here would mean.
  // `block` keeps it taking its own line, same as before.
  return <strong className="block font-semibold break-words">{children}</strong>;
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="break-words text-muted-foreground">{children}</p>;
}
