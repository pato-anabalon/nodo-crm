import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { QuoteForm } from "@/modules/quotes/quote-form";
import { hasActiveCatalogue } from "@/modules/catalogue/service";
import {
  hasActiveQuoteTemplates,
  templateDefaults,
} from "@/modules/quote-templates/service";
import { TemplatePicker } from "@/modules/quote-templates/template-picker";
import { searchTemplatesAction } from "@/modules/quote-templates/actions";
import { createQuoteAction } from "@/modules/quotes/actions";
import { leadTitle } from "@/modules/leads/service";
import { searchLeadsAction } from "@/modules/leads/actions";
import { searchCatalogueAction } from "@/modules/catalogue/actions";
import { defaultDocumentId, listCompanyDocuments } from "@/modules/documents/service";
import { defaultValidUntil } from "@/modules/quotes/constants";
import { currencyOptions } from "@/lib/intl/options";

export async function generateMetadata() {
  const t = await getTranslations("quotes");
  return { title: t("new") };
}

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; template?: string }>;
}) {
  const ctx = await requirePermission("quotes.create");
  const t = await getTranslations("quotes");
  const { leadId, template } = await searchParams;

  const [leadLabel, documents, defaultTerms, catalogueAvailable, companyQuoteTypes] =
    await Promise.all([
      leadId ? leadTitle(ctx, leadId) : null,
      listCompanyDocuments(ctx),
      defaultDocumentId(ctx),
      hasActiveCatalogue(ctx),
      ctx.db.companyQuoteType.findMany({ orderBy: { position: "asc" } }),
    ]);

  // A template only supplies starting values; nothing is written until the
  // person saves, and every field is still theirs to change.
  const [templatesAvailable, fromTemplate] = await Promise.all([
    hasActiveQuoteTemplates(ctx),
    template ? templateDefaults(ctx, template) : null,
  ]);

  const validUntil = defaultValidUntil(ctx.company.quoteValidityDays);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/quotes" aria-label={t("backToQuotes")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{t("new")}</h1>
      </div>

      <TemplatePicker
        available={templatesAvailable}
        current={template && fromTemplate ? { id: template, name: fromTemplate.name } : null}
        leadId={leadId ?? null}
        search={searchTemplatesAction}
      />

      <QuoteForm
        hasCatalogue={catalogueAvailable}
        searchLeads={searchLeadsAction}
        searchCatalogue={searchCatalogueAction}
        action={createQuoteAction}
        documents={documents.map((doc) => ({ id: doc.id, name: doc.name }))}
        quoteTypes={companyQuoteTypes.map((type) => type.label)}
        currency={ctx.company.currency}
        currencies={currencyOptions(await getLocale())}
        formatLocale={ctx.company.formatLocale}
        taxDisplayMode={ctx.company.taxDisplayMode}
        taxLabel={t(`taxType.${ctx.company.defaultTaxType}`)}
        submitLabel={t("create")}
        defaults={{
          leadId: leadId ?? null,
          leadTitle: leadLabel,
          ...(fromTemplate
            ? {
                title: fromTemplate.title,
                pricingMode: fromTemplate.pricingMode,
                items: fromTemplate.items,
                sections: fromTemplate.sections,
              }
            : {}),
          // The tax is proposed by the company; the quote keeps its own copy.
          taxRate: ctx.company.defaultTaxRate,
          // The company's copy comes preloaded and can be adjusted.
          // The template's copy wins when it has any; otherwise the company's.
          intro: fromTemplate?.intro ?? ctx.company.quoteIntro,
          notes: fromTemplate?.notes ?? ctx.company.quoteNotes,
          exclusions: fromTemplate?.exclusions ?? ctx.company.quoteExclusions,
          terms: fromTemplate?.terms ?? ctx.company.quoteTerms,
          scope: fromTemplate?.scope ?? ctx.company.quoteScope,
          termsDocumentId: defaultTerms,
          validUntil: validUntil.toISOString().slice(0, 10),
        }}
      />
    </div>
  );
}
