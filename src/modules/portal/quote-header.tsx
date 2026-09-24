import { getTranslations } from "next-intl/server";
import { CompanyLogo } from "@/components/company-logo";
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
};

/**
 * The document header: who is quoting, to whom, and the document's details.
 *
 * It's what turns the page into a formal quote rather than an email with figures:
 * without the phone number or the GST number, the customer has no way to call, and
 * no way to check who they're about to hire.
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
      <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="xl" />

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <Column label={t("from")}>
          {issuer?.name ? <Strong>{issuer.name}</Strong> : null}
          {issuer?.jobTitle ? <Line>{issuer.jobTitle}</Line> : null}
          {issuer?.phone ? <Line>{issuer.phone}</Line> : null}

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
        </Column>

        <Column label={t("for")}>
          {client.companyName ? <Strong>{client.companyName}</Strong> : null}

          {client.name ? (
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
        </Column>

        <Column label={t("quoteNumber")}>
          <Line>{reference}</Line>

          <Field label={t("date")}>
            <Line>
              {formatDate(quote.sentAt ?? quote.createdAt, company.formatLocale, company.timezone)}
            </Line>
          </Field>

          {quote.validUntil ? (
            <Field label={t("expiryDate")}>
              <Line>
                {formatDateTime(quote.validUntil, company.formatLocale, company.timezone)}
              </Line>
            </Field>
          ) : null}

          {printButton ? <div className="pt-3">{printButton}</div> : null}
        </Column>
      </div>
    </header>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 border-l pl-4 text-sm">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  return <p className="font-semibold break-words">{children}</p>;
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="break-words text-muted-foreground">{children}</p>;
}
