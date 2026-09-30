import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ActivityType, PricingMode, Prisma, QuoteStatus, type TaxDisplayMode } from "@/generated/prisma/client";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/rich-text";
import { calculateQuoteTotals } from "./totals";
import { canTransition, isQuoteEditable, sectionStatuses } from "./constants";
import { nextLeadStatus, type LeadEvent } from "@/modules/leads/constants";
import type { QuoteFilters, QuoteFormValues } from "./schemas";
import { companyDocumentSelect, quoteDocumentInclude } from "@/modules/portal/service";

export const QUOTES_PAGE_SIZE = 20;

/** Sanitises the editor's HTML and drops the empty paragraphs it leaves on delete. */
function cleanBody(body: string | null | undefined): string | null {
  const clean = sanitizeRichText(body);
  return isRichTextEmpty(clean) ? null : clean;
}

/**
 * The language the quote goes out in.
 *
 * Today the company quotes in its default language, not the rep's: someone
 * working in Spanish still quotes in English to a customer in Auckland.
 */
function languageFor(ctx: CompanyContext) {
  return ctx.company.defaultLanguage;
}

export function visibilityWhere(ctx: CompanyContext): Prisma.QuoteWhereInput {
  if (ctx.permissions.has("quotes.read.all")) return {};
  return { createdById: ctx.user.id };
}

export function buildQuoteWhere(ctx: CompanyContext, filters: QuoteFilters): Prisma.QuoteWhereInput {
  const where: Prisma.QuoteWhereInput = { ...visibilityWhere(ctx) };
  const and: Prisma.QuoteWhereInput[] = [];

  // The section narrows the set; the status filter refines within it.
  const sectionStatus = sectionStatuses(filters.section);
  if (sectionStatus) and.push({ status: { in: sectionStatus } });
  if (filters.status) and.push({ status: filters.status });
  if (filters.q) {
    const q = filters.q;
    const asNumber = Number(q.replace(/\D/g, ""));
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { lead: { title: { contains: q, mode: "insensitive" } } },
        ...(Number.isFinite(asNumber) && asNumber > 0 ? [{ number: asNumber }] : []),
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

export async function listQuotes(ctx: CompanyContext, filters: QuoteFilters) {
  const where = buildQuoteWhere(ctx, filters);
  const skip = (filters.page - 1) * QUOTES_PAGE_SIZE;

  const [items, total] = await Promise.all([
    ctx.db.quote.findMany({
      where,
      orderBy: { number: "desc" },
      skip,
      take: QUOTES_PAGE_SIZE,
      include: {
        lead: { select: { id: true, title: true } },
        createdBy: { select: { name: true, email: true } },
        // How often the customer opened it, and whether they have it open now.
        share: { select: { openCount: true, lastSeenAt: true, viewing: true } },
        _count: { select: { items: true } },
      },
    }),
    ctx.db.quote.count({ where }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / QUOTES_PAGE_SIZE)),
  };
}

/**
 * The quote as the customer sees it, loaded for the company's own preview.
 *
 * Reads through the same shape as the portal, so what the team previews can't
 * drift from what the customer opens. Visibility still applies: previewing is
 * reading, and whoever can't read this quote can't preview it either.
 */
export async function getQuoteDocument(ctx: CompanyContext, id: string) {
  const [company, quote] = await Promise.all([
    // Company is a global model, so `ctx.db` doesn't bound it: the company id
    // in the where is what keeps this from reading somebody else's branding.
    ctx.db.company.findFirst({
      where: { id: ctx.company.id },
      select: companyDocumentSelect,
    }),
    ctx.db.quote.findFirst({
      where: { id, ...visibilityWhere(ctx) },
      include: quoteDocumentInclude,
    }),
  ]);

  if (!company || !quote) return null;
  return { company, quote };
}

export async function getQuote(ctx: CompanyContext, id: string) {
  return ctx.db.quote.findFirst({
    where: { id, ...visibilityWhere(ctx) },
    include: {
      items: { orderBy: { position: "asc" } },
      sections: { orderBy: { position: "asc" } },
      attachments: { orderBy: { position: "asc" } },
      lead: { select: { id: true, title: true, contactName: true, contactEmail: true, companyName: true } },
      createdBy: { select: { name: true, email: true, jobTitle: true, phone: true } },
      termsDocument: { select: { name: true, url: true } },
      acceptance: true,
      share: {
        select: { lastSeenAt: true, viewing: true, openCount: true, revokedAt: true, expiresAt: true },
      },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      emailsSent: { orderBy: { sentAt: "desc" } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { authorUser: { select: { name: true, email: true } } },
      },
    },
  });
}

/**
 * The company's next sequential number.
 *
 * Resolved inside the creation transaction; if two users quote at the same
 * moment the unique index on `[companyId, number]` fails one of them, and
 * `createQuote` retries with the following number.
 */
async function nextQuoteNumber(tx: Prisma.TransactionClient, companyId: string): Promise<number> {
  const last = await tx.quote.findFirst({
    where: { companyId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

const MAX_NUMBER_RETRIES = 5;

/** The mode decides where the sum comes from; the rest of the maths is identical. */
function totalsFor(values: QuoteFormValues, taxDisplayMode: TaxDisplayMode) {
  const bySections = values.pricingMode === PricingMode.SECTIONS;
  return calculateQuoteTotals({
    items: bySections ? [] : values.items,
    sections: bySections ? values.sections.map((section) => section.amount) : null,
    taxRate: values.taxRate,
    discount: values.discount,
    taxDisplayMode,
  });
}

/**
 * Starts a new draft from an existing quote.
 *
 * Built by handing `createQuote` the same values a person would have typed,
 * rather than copying rows: the numbering, its retry on a clash, and the
 * snapshotting of the customer's details all live there and would otherwise
 * have to be repeated here and kept in step.
 *
 * The new draft takes the lead it is given, not the original's. Duplicating is
 * "quote this job like that one", and the job is usually somebody else's.
 */
export async function duplicateQuote(
  ctx: CompanyContext,
  id: string,
  leadId: string | null,
) {
  const source = await ctx.db.quote.findFirst({
    where: { id, ...visibilityWhere(ctx) },
    include: {
      items: { orderBy: { position: "asc" } },
      sections: { orderBy: { position: "asc" } },
    },
  });
  if (!source) return null;

  return createQuote(ctx, {
    title: source.title,
    pricingMode: source.pricingMode,
    leadId,
    taxRate: Number(source.taxRate),
    taxDisplayMode: source.taxDisplayMode,
    currency: source.currency,
    discount: Number(source.discount),
    intro: source.intro,
    exclusions: source.exclusions,
    notes: source.notes,
    terms: source.terms,
    termsDocumentId: source.termsDocumentId,
    // Not carried over: it was worked out for the job being copied, and the new
    // one starts its own clock from the company's validity setting.
    validUntil: null,
    items: source.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
    })),
    sections: source.sections.map((section) => ({
      title: section.title,
      body: section.body,
      amount: Number(section.amount),
    })),
  } as QuoteFormValues);
}

export async function createQuote(ctx: CompanyContext, values: QuoteFormValues) {
  // Suggested from the company's own setting; the form always sends one once
  // the person has seen the select, so this only matters before that.
  const taxDisplayMode = values.taxDisplayMode ?? ctx.company.taxDisplayMode;
  const totals = totalsFor(values, taxDisplayMode);
  const bySections = values.pricingMode === PricingMode.SECTIONS;

  // Customer details and company copy are snapshotted on issue: from here on the
  // document no longer depends on the lead or the settings staying the same
  // tomorrow.
  const lead = values.leadId
    ? await ctx.db.lead.findFirst({
        where: { id: values.leadId },
        select: { contactName: true, contactEmail: true, contactPhone: true, companyName: true },
      })
    : null;

  const validUntil = values.validUntil
    ? new Date(values.validUntil)
    : new Date(Date.now() + ctx.company.quoteValidityDays * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt++) {
    try {
      // Transaction on the base client: companyId is explicit and controlled
      // here, and `$transaction` doesn't travel through the tenant extension.
      return await prisma.$transaction(async (tx) => {
        const number = await nextQuoteNumber(tx, ctx.company.id);

        return tx.quote.create({
          data: {
            companyId: ctx.company.id,
            number,
            leadId: values.leadId ?? null,
            termsDocumentId: values.termsDocumentId ?? null,
            createdById: ctx.user.id,
            title: values.title,
            status: QuoteStatus.DRAFT,
            pricingMode: values.pricingMode,

            clientCompanyName: lead?.companyName ?? null,
            clientName: lead?.contactName ?? null,
            clientEmail: lead?.contactEmail ?? null,
            clientPhone: lead?.contactPhone ?? null,

            intro: values.intro ?? ctx.company.quoteIntro,
            exclusions: values.exclusions ?? ctx.company.quoteExclusions,

            // Frozen copies of the company settings at the moment of issue.
            taxDisplayMode,
            currency: values.currency ?? ctx.company.currency,
            language: languageFor(ctx),
            taxType: ctx.company.defaultTaxType,
            taxRate: values.taxRate,
            discount: totals.discount,
            subtotal: totals.subtotal,
            taxAmount: totals.taxAmount,
            total: totals.total,
            notes: values.notes ?? ctx.company.quoteNotes,
            terms: values.terms ?? ctx.company.quoteTerms,
            validUntil,
            sections: bySections
              ? {
                  create: values.sections.map((section, index) => ({
                    position: index,
                    title: section.title,
                    // Sanitised on the server: whatever arrives from the browser
                    // isn't trustworthy, and the customer ends up seeing this HTML.
                    body: cleanBody(section.body),
                    amount: section.amount,
                  })),
                }
              : undefined,
            // With sections there are no lines to store.
            items: bySections
              ? undefined
              : {
                  create: values.items.map((item, index) => ({
                    position: index,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    total: totals.lineTotals[index],
                  })),
                },
          },
        });
      });
    } catch (error) {
      if (isUniqueNumberConflict(error) && attempt < MAX_NUMBER_RETRIES - 1) continue;
      throw error;
    }
  }

  throw new Error("Could not assign a quote number");
}

function isUniqueNumberConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("number")
  );
}

export async function updateQuote(ctx: CompanyContext, id: string, values: QuoteFormValues) {
  const current = await ctx.db.quote.findFirst({
    where: { id, ...visibilityWhere(ctx) },
    select: { id: true, status: true, taxDisplayMode: true, leadId: true, number: true },
  });
  if (!current) return { ok: false as const, reason: "not-found" as const };
  if (!isQuoteEditable(current.status)) {
    return { ok: false as const, reason: "locked" as const };
  }

  // Falls back to what the quote already had, same as currency below — the
  // form always sends its own, this only matters for a caller that doesn't.
  const taxDisplayMode = values.taxDisplayMode ?? current.taxDisplayMode;
  const totals = totalsFor(values, taxDisplayMode);
  const bySections = values.pricingMode === PricingMode.SECTIONS;

  const quote = await ctx.db.quote.update({
    where: { id },
    data: {
      title: values.title,
      leadId: values.leadId ?? null,
      termsDocumentId: values.termsDocumentId ?? null,
      pricingMode: values.pricingMode,
      // Editable exactly as long as the rest of the quote is: the customer's
      // link is read live, so a currency correction reaches it same as any
      // other field. It freezes only once the quote is decided.
      currency: values.currency,
      intro: values.intro ?? null,
      exclusions: values.exclusions ?? null,
      taxRate: values.taxRate,
      taxDisplayMode,
      discount: totals.discount,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      notes: values.notes ?? null,
      terms: values.terms ?? null,
      validUntil: values.validUntil ? new Date(values.validUntil) : null,
      // Every section and line is replaced wholesale: simpler and more
      // predictable than matching up additions, removals and reordering one by one.
      sections: {
        deleteMany: {},
        create: bySections
          ? values.sections.map((section, index) => ({
              position: index,
              title: section.title,
              body: cleanBody(section.body),
              amount: section.amount,
            }))
          : [],
      },
      items: {
        deleteMany: {},
        create: bySections
          ? []
          : values.items.map((item, index) => ({
              position: index,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: totals.lineTotals[index],
            })),
      },
    },
  });

  // A sent quote being edited is worth a line in the lead's history — the
  // customer's link didn't change, but what's under it did. Not for a draft:
  // nobody has seen it yet, so there is nothing to record changing.
  if (current.status === QuoteStatus.SENT && current.leadId) {
    await ctx.db.activity.create({
      data: {
        companyId: ctx.company.id,
        leadId: current.leadId,
        userId: ctx.user.id,
        type: ActivityType.QUOTE_EDITED,
        content: String(current.number),
      },
    });
  }

  return { ok: true as const, quote };
}

export async function changeQuoteStatus(
  ctx: CompanyContext,
  id: string,
  to: QuoteStatus,
) {
  const current = await ctx.db.quote.findFirst({
    where: { id, ...visibilityWhere(ctx) },
    select: { id: true, status: true, leadId: true, number: true },
  });
  if (!current) return { ok: false as const, reason: "not-found" as const };
  if (!canTransition(current.status, to)) {
    return { ok: false as const, reason: "invalid-transition" as const };
  }

  const now = new Date();
  const quote = await ctx.db.quote.update({
    where: { id },
    data: {
      status: to,
      sentAt: to === QuoteStatus.SENT ? now : undefined,
      decidedAt:
        to === QuoteStatus.ACCEPTED || to === QuoteStatus.REJECTED ? now : undefined,
    },
  });

  if (current.leadId) {
    await ctx.db.activity.create({
      data: {
        companyId: ctx.company.id,
        leadId: current.leadId,
        userId: ctx.user.id,
        // Not `STATUS_CHANGE`: this is the quote moving, not the lead. Recording
        // it as the lead's own status put QuoteStatus values into a line that
        // renders them as lead statuses, and the log asked for a message key
        // that could never exist.
        type: to === QuoteStatus.SENT ? ActivityType.QUOTE_SENT : ActivityType.QUOTE_DECIDED,
        content: `${current.number}>${to}`,
      },
    });

    await moveLeadAlong(ctx, current.leadId, to);
  }

  return { ok: true as const, quote };
}

/**
 * Moves the lead its quote belongs to, when the quote's fate says something
 * about the work as a whole.
 *
 * A single declined quote isn't a lost lead: a job can be quoted twice, and the
 * second one may still be live. Only when nothing is left open does the work
 * count as lost.
 */
async function moveLeadAlong(ctx: CompanyContext, leadId: string, to: QuoteStatus) {
  let event: LeadEvent | null = null;

  if (to === QuoteStatus.SENT) event = "quote-sent";
  else if (to === QuoteStatus.ACCEPTED) event = "quote-accepted";
  else if (to === QuoteStatus.REJECTED || to === QuoteStatus.EXPIRED) {
    const stillOpen = await ctx.db.quote.count({
      where: { leadId, status: { in: [QuoteStatus.DRAFT, QuoteStatus.SENT] } },
    });
    if (stillOpen === 0) event = "quotes-all-declined";
  }

  if (!event) return;

  const lead = await ctx.db.lead.findFirst({ where: { id: leadId }, select: { status: true } });
  if (!lead) return;

  const next = nextLeadStatus(lead.status, event);
  if (!next) return;

  await ctx.db.lead.update({ where: { id: leadId }, data: { status: next } });

  // Recorded like any other move on the lead, so its history shows who and when
  // even though the "who" here is the quote rather than a person.
  await ctx.db.activity.create({
    data: {
      companyId: ctx.company.id,
      leadId,
      userId: ctx.user.id,
      type: ActivityType.STATUS_CHANGE,
      // The same separator the lead's own service writes, because the same
      // line reads both. An arrow here is how `leads.status.NEW → PROPOSAL`
      // ended up being asked for.
      content: `${lead.status}>${next}`,
    },
  });
}

export async function deleteQuote(ctx: CompanyContext, id: string) {
  const { count } = await ctx.db.quote.deleteMany({ where: { id, status: QuoteStatus.DRAFT } });
  return count > 0;
}
