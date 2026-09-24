import type { CompanyContext } from "@/lib/auth/session";
import { PricingMode } from "@/generated/prisma/enums";
import { visibilityWhere } from "@/modules/quotes/service";
import type { TemplateNameValues } from "./schemas";

export async function listQuoteTemplates(ctx: CompanyContext, includeRetired = false) {
  return ctx.db.quoteTemplate.findMany({
    where: includeRetired ? {} : { active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { items: true, sections: true } } },
  });
}

/** The ones offered when starting a quote. Retired templates are never proposed. */
export async function activeQuoteTemplates(ctx: CompanyContext) {
  return ctx.db.quoteTemplate.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
}

export async function getQuoteTemplate(ctx: CompanyContext, id: string) {
  return ctx.db.quoteTemplate.findFirst({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      sections: { orderBy: { position: "asc" } },
    },
  });
}

/**
 * Saves a quote's shape under a name.
 *
 * What it keeps is the *work*: the lines, the sections and the copy. What it
 * deliberately drops is everything belonging to one job — the customer, the
 * lead, the dates, the totals. That is the difference between a template and the
 * old quote it came from, and forgetting it is how a template ends up carrying
 * somebody else's address into the next one.
 */
export async function createTemplateFromQuote(
  ctx: CompanyContext,
  quoteId: string,
  values: TemplateNameValues,
) {
  const quote = await ctx.db.quote.findFirst({
    where: { id: quoteId, ...visibilityWhere(ctx) },
    include: {
      items: { orderBy: { position: "asc" } },
      sections: { orderBy: { position: "asc" } },
    },
  });
  if (!quote) return null;

  return ctx.db.quoteTemplate.create({
    data: {
      companyId: ctx.company.id,
      name: values.name,
      description: values.description ?? null,
      titlePattern: quote.title,
      pricingMode: quote.pricingMode,
      intro: quote.intro,
      notes: quote.notes,
      terms: quote.terms,
      exclusions: quote.exclusions,
      items: {
        create: quote.items.map((item, position) => ({
          position,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
      },
      sections: {
        create: quote.sections.map((section, position) => ({
          position,
          title: section.title,
          body: section.body,
          amount: section.amount,
        })),
      },
    },
  });
}

export async function renameQuoteTemplate(
  ctx: CompanyContext,
  id: string,
  values: TemplateNameValues,
): Promise<boolean> {
  const { count } = await ctx.db.quoteTemplate.updateMany({
    where: { id },
    data: { name: values.name, description: values.description ?? null },
  });
  return count > 0;
}

export async function setQuoteTemplateActive(
  ctx: CompanyContext,
  id: string,
  active: boolean,
): Promise<boolean> {
  const { count } = await ctx.db.quoteTemplate.updateMany({ where: { id }, data: { active } });
  return count > 0;
}

export async function deleteQuoteTemplate(ctx: CompanyContext, id: string): Promise<boolean> {
  const { count } = await ctx.db.quoteTemplate.deleteMany({ where: { id } });
  return count > 0;
}

/**
 * A template as the quote form's starting values.
 *
 * Only ever *defaults*: the person still sees every field and can change any of
 * them before saving. Nothing is written until they do.
 */
export async function templateDefaults(ctx: CompanyContext, id: string) {
  const template = await getQuoteTemplate(ctx, id);
  if (!template) return null;

  return {
    title: template.titlePattern ?? template.name,
    pricingMode: template.pricingMode,
    intro: template.intro,
    notes: template.notes,
    terms: template.terms,
    exclusions: template.exclusions,
    items: template.items.map((item) => ({
      description: item.description,
      quantity: String(Number(item.quantity)),
      unitPrice: String(Number(item.unitPrice)),
      discount: String(Number(item.discount)),
    })),
    sections: template.sections.map((section) => ({
      title: section.title,
      body: section.body ?? "",
      amount: String(Number(section.amount)),
    })),
    isSections: template.pricingMode === PricingMode.SECTIONS,
  };
}
