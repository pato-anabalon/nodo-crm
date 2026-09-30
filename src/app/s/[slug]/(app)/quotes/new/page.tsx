import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { QuoteForm } from "@/modules/quotes/quote-form";
import { activeCatalogue } from "@/modules/catalogue/service";
import { activeQuoteTemplates, templateDefaults } from "@/modules/quote-templates/service";
import { TemplatePicker } from "@/modules/quote-templates/template-picker";
import { createQuoteAction } from "@/modules/quotes/actions";
import { listLeads } from "@/modules/leads/service";
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

  // The leads a user can see are the ones they can quote for.
  const [{ items: leads }, documents, defaultTerms, catalogue] = await Promise.all([
    listLeads(ctx, { page: 1, discarded: false }),
    listCompanyDocuments(ctx),
    defaultDocumentId(ctx),
    activeCatalogue(ctx),
  ]);

  // A template only supplies starting values; nothing is written until the
  // person saves, and every field is still theirs to change.
  const [templates, fromTemplate] = await Promise.all([
    activeQuoteTemplates(ctx),
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

      <TemplatePicker templates={templates} current={template ?? null} leadId={leadId ?? null} />

      <QuoteForm
          catalogue={toOptions(catalogue)}
        action={createQuoteAction}
        leads={leads.map((lead) => ({ id: lead.id, title: lead.title }))}
        documents={documents.map((doc) => ({ id: doc.id, name: doc.name }))}
        currency={ctx.company.currency}
        currencies={currencyOptions(await getLocale())}
        formatLocale={ctx.company.formatLocale}
        taxDisplayMode={ctx.company.taxDisplayMode}
        taxLabel={t(`taxType.${ctx.company.defaultTaxType}`)}
        submitLabel={t("create")}
        defaults={{
          leadId: leadId ?? null,
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
          termsDocumentId: defaultTerms,
          validUntil: validUntil.toISOString().slice(0, 10),
        }}
      />
    </div>
  );
}

/** Prisma hands back a Decimal; the form fields are text. */
function toOptions(items: { id: string; name: string; description: string | null; unit: string | null; unitPrice: unknown }[]) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    unit: item.unit,
    unitPrice: String(Number(item.unitPrice)),
  }));
}
