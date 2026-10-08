import {
  Document,
  Image,
  Link,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@/generated/prisma/client";
import { PricingMode, QuoteStatus } from "@/generated/prisma/enums";
import type { Locale } from "@/i18n/config";
import { formatDate, formatDateTime, formatMoney, formatQuoteNumber } from "@/lib/format";
import { hexToOklch, inkOn, oklchToHex } from "@/lib/theme/color";
import { initials } from "@/components/company-logo";
import {
  resolveSelectedSectionAmounts,
  type SectionSelectionState,
} from "@/modules/quotes/section-selection";
import {
  calculateQuoteTotals,
  sectionNetAmount,
  taxIsInTotal,
} from "@/modules/quotes/totals";
import { companyDocumentSelect, quoteDocumentInclude } from "@/modules/portal/service";
import { bundleFrom } from "@/modules/quotes/service";
import { ensureFontsRegistered } from "./fonts";
import { RichTextPdf } from "./rich-text";

export type PdfCompany = Prisma.CompanyGetPayload<{ select: typeof companyDocumentSelect }>;
export type PdfQuote = Prisma.QuoteGetPayload<{ include: typeof quoteDocumentInclude }>;

const FOREGROUND = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Geist",
    fontSize: 10,
    lineHeight: 1.4,
    color: FOREGROUND,
    // Geist's "fi"/"fl" pair is one glyph in the font's own ligature table,
    // and PDFKit's text extraction doesn't map it back to two characters —
    // "waterproofing" came back "waterproofng". Off is what keeps every
    // letter its own glyph; it reads identically; it just no longer drops one.
    fontFeatureSettings: { liga: false },
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logoBox: {
    width: 90,
    height: 90,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    borderStyle: "solid",
    borderRadius: 6,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  logoImage: { width: "100%", height: "100%", objectFit: "contain" },
  logoInitials: { fontSize: 24, fontFamily: "Geist", fontWeight: "bold", color: "#ffffff" },
  metaColumn: { alignItems: "flex-end" },
  metaBlock: { marginBottom: 8, alignItems: "flex-end" },
  label: { fontSize: 8, fontFamily: "Geist", fontWeight: "bold", letterSpacing: 0.5 },
  value: { fontSize: 10, color: MUTED, marginTop: 1 },
  partyRow: { flexDirection: "row", gap: 16, marginBottom: 20 },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    padding: 10,
  },
  strong: { fontFamily: "Geist", fontWeight: "bold" },
  fieldSpacer: { marginTop: 6 },
  title: { fontSize: 20, fontFamily: "Geist", fontWeight: "bold", lineHeight: 1.3, marginBottom: 12 },
  introSection: { marginBottom: 16 },
  sectionBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 10,
    marginBottom: 14,
    overflow: "hidden",
  },
  sectionBoxExcluded: { opacity: 0.5 },
  sectionBody: { flex: 1, padding: 12, color: "#000000" },
  sectionTitle: { fontSize: 12, fontFamily: "Geist", fontWeight: "bold", marginBottom: 6 },
  sectionPriceCol: {
    width: 110,
    backgroundColor: "#e5e7eb",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 10,
  },
  sectionPrice: { fontSize: 12, fontFamily: "Geist", fontWeight: "bold" },
  sectionPriceWas: { fontSize: 8, color: MUTED, textDecoration: "line-through" },
  sectionTag: { fontSize: 7, color: MUTED, marginTop: 4, textTransform: "uppercase" },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: "solid",
  },
  itemDescription: { flex: 1, paddingRight: 8 },
  totals: { alignSelf: "flex-end", width: 220, marginTop: 10 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  totalsLabel: { color: MUTED },
  totalsValue: {},
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 4,
  },
  grandTotalLabel: { fontFamily: "Geist", fontWeight: "bold", fontSize: 11 },
  grandTotalValue: { fontFamily: "Geist", fontWeight: "bold", fontSize: 11 },
  block: { marginTop: 18 },
  blockTitle: { fontSize: 11, fontFamily: "Geist", fontWeight: "bold", marginBottom: 6 },
  attachmentsList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  attachmentChip: {
    fontSize: 9,
    color: "#2563eb",
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  banner: {
    marginTop: 16,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: BORDER,
    borderRadius: 8,
    padding: 10,
  },
  reviewsGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 20 },
  reviewCard: { width: "50%", paddingRight: 16, marginBottom: 14 },
  stars: { flexDirection: "row", marginBottom: 4 },
  star: { marginRight: 2 },
  reviewBody: { color: MUTED, marginBottom: 4 },
  reviewAuthor: { fontStyle: "italic" },
  watermark: {
    position: "absolute",
    width: 154, // 220 * 0.7 — 30% smaller.
    opacity: 0.12,
    right: 48,
    bottom: 48,
  },
});

/** The company's colour, as text — the same `inkOn` pipeline `BrandTheme`
 * uses for `--brand-ink` on the web, against a white page (there is no dark
 * mode on paper). React PDF styles take a literal colour, not a CSS variable,
 * so this is resolved once up front rather than referenced by name. */
function brandInk(primaryColor: string): string {
  const oklch = hexToOklch(primaryColor);
  if (!oklch) return primaryColor;
  return oklchToHex(inkOn(oklch, "#ffffff")) ?? primaryColor;
}

/**
 * The quote, laid out as a PDF document in its own right.
 *
 * Not a capture of the web page — React PDF has no browser and no CSS engine
 * of its own, so this is a second, deliberately simpler layout built from the
 * same data the portal reads (`companyDocumentSelect` / `quoteDocumentInclude`,
 * imported from the one place that defines them). Totals and section selection
 * still run through `calculateQuoteTotals` and `resolveSelectedSectionAmounts`
 * — the figures a customer sees here must be the ones they'd see live, not a
 * third implementation of what a quote adds up to.
 */
export async function buildQuotePdfDocument({
  company,
  quote,
  locale,
}: {
  company: PdfCompany;
  quote: PdfQuote;
  locale: Locale;
}) {
  ensureFontsRegistered();
  const t = await getTranslations({ locale, namespace: "portal" });
  const money = (value: number) => formatMoney(value, quote.currency, company.formatLocale);
  const ink = brandInk(company.primaryColor);
  const taxLabel = quote.taxType;
  const showTaxBreakdown = taxIsInTotal(quote.taxDisplayMode);
  const hasSelectableSections =
    quote.pricingMode === PricingMode.SECTIONS &&
    quote.sections.some((section) => section.kind !== "INDEPENDENT");

  const totalLabel = (() => {
    if (quote.taxDisplayMode === "NO_TAX") return t("totalPlain", { currency: quote.currency });
    return showTaxBreakdown
      ? t("totalIncluding", { currency: quote.currency, tax: taxLabel })
      : t("totalExcluding", { currency: quote.currency, tax: taxLabel });
  })();

  // Sections with a choice attached are never frozen on the quote row itself
  // (only the acceptance freeze and a scheduled follow-up resave it) — the
  // live portal recomputes from `customerSelected` on every render, and this
  // has to match it rather than read `quote.total`, which would be stale the
  // moment a customer ticks a box.
  let resolvedTotals = {
    subtotal: Number(quote.subtotal),
    discount: Number(quote.discount),
    taxAmount: Number(quote.taxAmount),
    total: Number(quote.total),
  };
  let bundleDiscountApplied = 0;
  let includedSectionIds: Set<string> | null = null;

  if (hasSelectableSections) {
    const sections = quote.sections.map((section) => ({
      id: section.id,
      amount: Number(section.amount),
      discountType: section.discountType,
      discountValue: Number(section.discountValue),
      kind: section.kind,
      selectedByDefault: section.selectedByDefault,
    }));
    const selection: SectionSelectionState = Object.fromEntries(
      quote.sections.map((section) => [section.id, section.customerSelected]),
    );
    const bundle = bundleFrom({
      optionalDiscountThreshold: quote.optionalDiscountThreshold,
      optionalDiscountType: quote.optionalDiscountType,
      optionalDiscountValue:
        quote.optionalDiscountValue === null ? null : Number(quote.optionalDiscountValue),
    });
    const resolved = resolveSelectedSectionAmounts(sections, selection, bundle);
    includedSectionIds = new Set(resolved.included.map((s) => s.id));
    bundleDiscountApplied = resolved.bundleDiscountApplied;

    const totals = calculateQuoteTotals({
      sections: [resolved.sectionsTotal],
      taxRate: Number(quote.taxRate),
      discount: Number(quote.discountValue),
      discountType: quote.discountType,
      taxDisplayMode: quote.taxDisplayMode,
    });
    resolvedTotals = {
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxAmount: totals.taxAmount,
      total: totals.total,
    };
  }

  return (
    <Document title={`${formatQuoteNumber(company.quotePrefix, quote.number)} — ${quote.title}`}>
      <Page size="A4" style={styles.page} wrap>
        <Header company={company} quote={quote} t={t} ink={ink} />
        <Parties company={company} quote={quote} t={t} ink={ink} />

        <Text style={styles.title}>
          {quote.quoteType ? `${quote.quoteType}: ` : ""}
          {quote.title}
        </Text>
        {quote.projectAddress ? (
          <Field label={t("projectAddress")} ink={ink}>
            {quote.projectAddress}
          </Field>
        ) : null}
        {quote.scope ? (
          <View style={styles.fieldSpacer}>
            <Text style={[styles.label, { color: ink }]}>{t("scope")}</Text>
            <RichTextPdf html={quote.scope} style={{ marginTop: 2 }} />
          </View>
        ) : null}

        <View style={styles.introSection}>
          <RichTextPdf html={quote.intro} />
        </View>

        {quote.pricingMode === PricingMode.SECTIONS ? (
          <View>
            {quote.sections.map((section) => (
              <SectionBox
                key={section.id}
                section={section}
                money={money}
                t={t}
                included={includedSectionIds ? includedSectionIds.has(section.id) : true}
                showStatus={hasSelectableSections}
              />
            ))}
          </View>
        ) : (
          <View>
            {quote.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemDescription}>
                  {item.description}{" "}
                  <Text style={{ color: MUTED }}>× {Number(item.quantity)}</Text>
                </Text>
                <Text>{money(Number(item.total))}</Text>
              </View>
            ))}
          </View>
        )}

        {quote.attachments.length > 0 ? (
          <Attachments attachments={quote.attachments} t={t} ink={ink} />
        ) : null}

        <View style={styles.totals}>
          <TotalsRow label={t("subtotal")} value={money(resolvedTotals.subtotal)} />
          {bundleDiscountApplied > 0 ? (
            <TotalsRow
              label={t("bundleDiscount")}
              value={`− ${money(bundleDiscountApplied)}`}
            />
          ) : null}
          {resolvedTotals.discount > 0 ? (
            <TotalsRow label={t("discount")} value={`− ${money(resolvedTotals.discount)}`} />
          ) : null}
          {showTaxBreakdown ? (
            <TotalsRow
              label={`${taxLabel} ${Number(quote.taxRate)}%`}
              value={money(resolvedTotals.taxAmount)}
            />
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>{totalLabel}</Text>
            <Text style={styles.grandTotalValue}>{money(resolvedTotals.total)}</Text>
          </View>
        </View>

        {quote.status === QuoteStatus.ACCEPTED && quote.acceptance ? (
          <View style={styles.banner}>
            <Text>
              {t("accepted", {
                date: formatDateTime(
                  quote.acceptance.acceptedAt,
                  company.formatLocale,
                  company.timezone,
                ),
              })}
            </Text>
          </View>
        ) : null}
        {quote.status === QuoteStatus.REJECTED ? (
          <View style={styles.banner}>
            <Text>
              {t("declined", {
                date: quote.decidedAt
                  ? formatDateTime(quote.decidedAt, company.formatLocale, company.timezone)
                  : "",
              })}
            </Text>
          </View>
        ) : null}

        {quote.notes ? (
          <Block title={t("notes")}>
            <RichTextPdf html={quote.notes} />
          </Block>
        ) : null}
        {quote.terms ? (
          <Block title={t("termsOfQuotation")}>
            <RichTextPdf html={quote.terms} />
          </Block>
        ) : null}
        {quote.termsDocument ? (
          <View style={{ marginTop: 6 }}>
            <Link src={quote.termsDocument.url} style={styles.attachmentChip}>
              {quote.termsDocument.name}
            </Link>
          </View>
        ) : null}
        {quote.exclusions ? (
          <Block title={t("exclusions")}>
            <RichTextPdf html={quote.exclusions} />
          </Block>
        ) : null}

        {company.reviews.length > 0 ? (
          <View style={styles.block} wrap={false}>
            <Text style={styles.blockTitle}>{t("reviews")}</Text>
            <View style={styles.reviewsGrid}>
              {company.reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <Stars rating={review.rating} ink={ink} />
                  <Text style={styles.reviewBody}>{review.body}</Text>
                  <Text style={styles.reviewAuthor}>
                    {t("reviewBy", { author: review.author })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {company.watermarkUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={company.watermarkUrl} style={styles.watermark} fixed />
        ) : null}
      </Page>
    </Document>
  );
}

/** `buildQuotePdfDocument` resolves translations and totals; this just hands
 * the finished tree to React PDF's own renderer and waits for the bytes. */
export async function renderQuotePdfBuffer(
  input: Parameters<typeof buildQuotePdfDocument>[0],
): Promise<Buffer> {
  const document = await buildQuotePdfDocument(input);
  return renderToBuffer(document);
}

function Header({
  company,
  quote,
  t,
  ink,
}: {
  company: PdfCompany;
  quote: PdfQuote;
  t: Awaited<ReturnType<typeof getTranslations>>;
  ink: string;
}) {
  const reference = formatQuoteNumber(company.quotePrefix, quote.number);
  return (
    <View style={styles.headerRow}>
      {company.logoUrl ? (
        <View style={styles.logoBox}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={company.logoUrl} style={styles.logoImage} />
        </View>
      ) : (
        <View style={[styles.logoBox, { backgroundColor: company.primaryColor, borderWidth: 0 }]}>
          <Text style={styles.logoInitials}>{initials(company.name)}</Text>
        </View>
      )}

      <View style={styles.metaColumn}>
        <View style={styles.metaBlock}>
          <Text style={[styles.label, { color: ink }]}>{t("quoteNumber")}</Text>
          <Text style={styles.value}>{reference}</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={[styles.label, { color: ink }]}>{t("date")}</Text>
          <Text style={styles.value}>
            {formatDate(
              quote.sentAt ?? quote.createdAt,
              company.formatLocale,
              company.timezone,
            )}
          </Text>
        </View>
        {quote.validUntil ? (
          <View style={styles.metaBlock}>
            <Text style={[styles.label, { color: ink }]}>{t("expiryDate")}</Text>
            <Text style={styles.value}>
              {formatDateTime(quote.validUntil, company.formatLocale, company.timezone)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Parties({
  company,
  quote,
  t,
  ink,
}: {
  company: PdfCompany;
  quote: PdfQuote;
  t: Awaited<ReturnType<typeof getTranslations>>;
  ink: string;
}) {
  const issuer = quote.createdBy;
  return (
    <View style={styles.partyRow}>
      <View style={styles.partyCard}>
        <Text style={[styles.label, { color: ink }]}>{t("from")}</Text>
        {issuer?.name ? <Text style={[styles.strong, styles.fieldSpacer]}>{issuer.name}</Text> : null}
        {issuer?.jobTitle ? <Text style={{ color: MUTED }}>{issuer.jobTitle}</Text> : null}
        <Text style={[styles.strong, styles.fieldSpacer]}>{company.legalName ?? company.name}</Text>
        {company.address ? <Text style={{ color: MUTED }}>{company.address}</Text> : null}
        {company.website ? <Text style={{ color: MUTED }}>{company.website}</Text> : null}
        {company.phone ? (
          <Field label={t("phone")} ink={ink}>
            {company.phone}
          </Field>
        ) : null}
        {company.taxId ? (
          <Field label={t("gstNumber")} ink={ink}>
            {company.taxId}
          </Field>
        ) : null}
      </View>

      <View style={styles.partyCard}>
        <Text style={[styles.label, { color: ink }]}>{t("for")}</Text>
        {quote.clientCompanyName ? (
          <Text style={[styles.strong, styles.fieldSpacer]}>{quote.clientCompanyName}</Text>
        ) : quote.clientName ? (
          <Text style={[styles.strong, styles.fieldSpacer]}>{quote.clientName}</Text>
        ) : null}
        {quote.clientName && quote.clientCompanyName ? (
          <Field label={t("to")} ink={ink}>
            {quote.clientName}
          </Field>
        ) : null}
        {quote.clientEmail ? (
          <Field label={t("email")} ink={ink}>
            {quote.clientEmail}
          </Field>
        ) : null}
        {quote.clientPhone ? (
          <Field label={t("mobile")} ink={ink}>
            {quote.clientPhone}
          </Field>
        ) : null}
      </View>
    </View>
  );
}

function Field({
  label,
  ink,
  children,
}: {
  label: string;
  ink: string;
  children: string;
}) {
  return (
    <View style={styles.fieldSpacer}>
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
      <Text style={{ color: MUTED, marginTop: 1 }}>{children}</Text>
    </View>
  );
}

function SectionBox({
  section,
  money,
  t,
  included,
  showStatus,
}: {
  section: PdfQuote["sections"][number];
  money: (value: number) => string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  included: boolean;
  showStatus: boolean;
}) {
  const gross = Number(section.amount);
  const discountValue = Number(section.discountValue);
  const net = sectionNetAmount({
    amount: gross,
    discountType: section.discountType,
    discountValue,
  });
  const discountLabel =
    section.discountType === "PERCENT"
      ? t("sectionDiscountOff", { amount: `${discountValue}%` })
      : t("sectionDiscountOff", { amount: money(discountValue) });

  return (
    <View
      style={[styles.sectionBox, included ? undefined : styles.sectionBoxExcluded]}
      wrap={false}
    >
      <View style={styles.sectionBody}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <RichTextPdf html={section.body} />
      </View>
      <View style={styles.sectionPriceCol}>
        {discountValue > 0 ? (
          <Text style={styles.sectionPriceWas}>{money(gross)}</Text>
        ) : null}
        {discountValue > 0 ? <Text style={{ fontSize: 8, marginTop: 2 }}>{discountLabel}</Text> : null}
        <Text style={styles.sectionPrice}>{money(net)}</Text>
        {showStatus ? (
          <Text style={styles.sectionTag}>
            {included
              ? section.kind === "MULTIPLE_CHOICE"
                ? "Chosen"
                : "Included"
              : "Not included"}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Attachments({
  attachments,
  t,
  ink,
}: {
  attachments: PdfQuote["attachments"];
  t: Awaited<ReturnType<typeof getTranslations>>;
  ink: string;
}) {
  return (
    <View style={{ marginVertical: 10 }}>
      <Text style={[styles.label, { color: ink }]}>{t("attachments")}</Text>
      <View style={styles.attachmentsList}>
        {attachments.map((attachment) => (
          <Link key={attachment.id} src={attachment.url} style={styles.attachmentChip}>
            {attachment.name}
          </Link>
        ))}
      </View>
    </View>
  );
}

function TotalsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalsRow}>
      <Text style={styles.totalsLabel}>{label}</Text>
      <Text style={styles.totalsValue}>{value}</Text>
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block} wrap={false}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

// The same outline lucide-react's `Star` draws on the web (`lucide-react/icons/star`),
// so a rating reads as the same mark in both places rather than a dot standing in for it.
const STAR_PATH =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

function Stars({ rating, ink }: { rating: number; ink: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, index) => (
        <Svg key={index} width={11} height={11} viewBox="0 0 24 24" style={styles.star}>
          <Path d={STAR_PATH} fill={index < filled ? ink : "#e5e7eb"} />
        </Svg>
      ))}
    </View>
  );
}
