import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ActivityType, PricingMode, Prisma, QuoteStatus, type TaxDisplayMode } from "@/generated/prisma/client";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/rich-text";
import { calculateQuoteTotals } from "./totals";
import { resolveSelectedSectionAmounts, type BundleDiscount } from "./section-selection";
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
 * The most recent quotes in a status, ordered by the date that status
 * actually reflects — sent by `sentAt`, accepted by `decidedAt` — the same
 * distinction the reports draw between the two. Backs the dashboard's "Last
 * sent" and "Last accepted" panels.
 */
export function recentQuotesByStatus(
  ctx: CompanyContext,
  status: QuoteStatus,
  orderBy: "sentAt" | "decidedAt",
  take = 5,
) {
  return ctx.db.quote.findMany({
    where: { ...visibilityWhere(ctx), status },
    orderBy: { [orderBy]: "desc" },
    take,
    select: {
      id: true,
      title: true,
      number: true,
      status: true,
      total: true,
      currency: true,
    },
  });
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
      sections: {
        orderBy: { position: "asc" },
        include: { attachments: { orderBy: { position: "asc" } } },
      },
      // Section-scoped attachments travel with their section above, not
      // here, or they'd show twice — once at the top of the quote, once
      // inside the section they actually belong to.
      attachments: { where: { sectionId: null }, orderBy: { position: "asc" } },
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
/** `null` unless all three bundle fields are actually set — any one missing
 * means "not configured", not "configured with a gap". */
export function bundleFrom(values: {
  optionalDiscountThreshold?: number | null;
  optionalDiscountType?: string | null;
  optionalDiscountValue?: number | null;
}): BundleDiscount | null {
  if (
    values.optionalDiscountThreshold == null ||
    !values.optionalDiscountType ||
    values.optionalDiscountValue == null
  ) {
    return null;
  }
  return {
    threshold: values.optionalDiscountThreshold,
    type: values.optionalDiscountType as BundleDiscount["type"],
    value: values.optionalDiscountValue,
  };
}

function totalsFor(values: QuoteFormValues, taxDisplayMode: TaxDisplayMode) {
  const bySections = values.pricingMode === PricingMode.SECTIONS;
  // No selection yet — every OPTIONAL/MULTIPLE_CHOICE section falls back to
  // its own `selectedByDefault`, which is exactly "how this quote looks the
  // moment it's sent, before the customer has touched anything". The
  // selection map stays empty here, so the synthetic id below (the row's
  // index — these aren't persisted yet, so there's no real id to use) never
  // actually gets looked up.
  const sectionsTotal = bySections
    ? resolveSelectedSectionAmounts(
        values.sections.map((section, index) => ({ ...section, id: String(index) })),
        {},
        bundleFrom(values),
      ).sectionsTotal
    : null;

  return calculateQuoteTotals({
    items: bySections ? [] : values.items,
    sections: sectionsTotal === null ? null : [sectionsTotal],
    taxRate: values.taxRate,
    discount: values.discount,
    discountType: values.discountType,
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
    // The raw input, not the computed `discount` amount — `createQuote`
    // recomputes the latter itself from this.
    discount: Number(source.discountValue),
    discountType: source.discountType,
    optionalDiscountThreshold: source.optionalDiscountThreshold,
    optionalDiscountType: source.optionalDiscountType,
    optionalDiscountValue:
      source.optionalDiscountValue === null ? null : Number(source.optionalDiscountValue),
    intro: source.intro,
    exclusions: source.exclusions,
    scope: source.scope,
    // Already-frozen text, copied as-is — not re-resolved against the
    // company's current list, same as currency/taxDisplayMode above it.
    quoteType: source.quoteType,
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
      discountType: section.discountType,
      discountValue: Number(section.discountValue),
      kind: section.kind,
      selectedByDefault: section.selectedByDefault,
      // Not `customerSelected` — a duplicate is a new, undecided quote.
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
  const [lead, companyQuoteTypes] = await Promise.all([
    values.leadId
      ? ctx.db.lead.findFirst({
          where: { id: values.leadId },
          select: { contactName: true, contactEmail: true, contactPhone: true, companyName: true },
        })
      : null,
    // Only needed as a fallback when the form sends none — a quote created
    // before the person has seen the select, or a company with just one type.
    values.quoteType ? null : ctx.db.companyQuoteType.findMany({ orderBy: { position: "asc" }, take: 1 }),
  ]);

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

            intro: cleanBody(values.intro ?? ctx.company.quoteIntro),
            exclusions: cleanBody(values.exclusions ?? ctx.company.quoteExclusions),
            scope: cleanBody(values.scope ?? ctx.company.quoteScope),
            quoteType: values.quoteType ?? companyQuoteTypes?.[0]?.label ?? null,
            projectAddress: values.projectAddress ?? null,

            // Frozen copies of the company settings at the moment of issue.
            taxDisplayMode,
            currency: values.currency ?? ctx.company.currency,
            language: languageFor(ctx),
            taxType: ctx.company.defaultTaxType,
            taxRate: values.taxRate,
            discount: totals.discount,
            // The raw typed input, separate from the computed amount above —
            // recomputing against a different gross later needs the original
            // intent ("10%"), not what it happened to produce this time.
            discountType: values.discountType,
            discountValue: values.discount,
            optionalDiscountThreshold: values.optionalDiscountThreshold ?? null,
            optionalDiscountType: values.optionalDiscountType ?? null,
            optionalDiscountValue: values.optionalDiscountValue ?? null,
            subtotal: totals.subtotal,
            taxAmount: totals.taxAmount,
            total: totals.total,
            notes: cleanBody(values.notes ?? ctx.company.quoteNotes),
            terms: cleanBody(values.terms ?? ctx.company.quoteTerms),
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
                    discountType: section.discountType,
                    discountValue: section.discountValue,
                    kind: section.kind,
                    selectedByDefault: section.selectedByDefault,
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

  // Sections keep their identity across a save now, matched by the id the
  // form already carries — not replaced wholesale, the way items still are.
  // That's what lets a section's own attachments (and, as a direct
  // consequence, the customer's prior tick on it) survive an edit elsewhere
  // in the quote. An incoming id only counts as a match when it's one of
  // *this* quote's own rows — anything else (a brand new section, a stray
  // value) is simply treated as new, never used to adopt another quote's row.
  const existingSectionIds = bySections
    ? new Set(
        (await ctx.db.quoteSection.findMany({ where: { quoteId: id }, select: { id: true } })).map(
          (section) => section.id,
        ),
      )
    : new Set<string>();
  const keptSectionIds = bySections
    ? values.sections
        .map((section) => section.id)
        .filter((sectionId): sectionId is string => !!sectionId && existingSectionIds.has(sectionId))
    : [];

  // Transaction on the base client: companyId is explicit and controlled
  // here, and `$transaction` doesn't travel through the tenant extension.
  const quote = await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.update({
      where: { id, companyId: ctx.company.id },
      data: {
        title: values.title,
        leadId: values.leadId ?? null,
        termsDocumentId: values.termsDocumentId ?? null,
        pricingMode: values.pricingMode,
        // Editable exactly as long as the rest of the quote is: the customer's
        // link is read live, so a currency correction reaches it same as any
        // other field. It freezes only once the quote is decided.
        currency: values.currency,
        intro: cleanBody(values.intro),
        exclusions: cleanBody(values.exclusions),
        scope: cleanBody(values.scope),
        quoteType: values.quoteType ?? null,
        projectAddress: values.projectAddress ?? null,
        taxRate: values.taxRate,
        taxDisplayMode,
        discount: totals.discount,
        discountType: values.discountType,
        discountValue: values.discount,
        optionalDiscountThreshold: values.optionalDiscountThreshold ?? null,
        optionalDiscountType: values.optionalDiscountType ?? null,
        optionalDiscountValue: values.optionalDiscountValue ?? null,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        notes: cleanBody(values.notes),
        terms: cleanBody(values.terms),
        validUntil: values.validUntil ? new Date(values.validUntil) : null,
        // Lines stay wholesale-replaced — there's nothing per-line that needs
        // to survive an edit the way a section's attachments now do.
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

    if (bySections) {
      // Removed by the user — cascades its attachments, correctly: a section
      // that's gone shouldn't leave its files behind.
      await tx.quoteSection.deleteMany({
        where: { quoteId: id, id: { notIn: keptSectionIds } },
      });

      for (const [index, section] of values.sections.entries()) {
        const data = {
          position: index,
          title: section.title,
          body: cleanBody(section.body),
          amount: section.amount,
          discountType: section.discountType,
          discountValue: section.discountValue,
          kind: section.kind,
          selectedByDefault: section.selectedByDefault,
        };

        if (section.id && existingSectionIds.has(section.id)) {
          // A kept row: updated in place, `customerSelected` left untouched.
          // Wiping it on every edit was only ever a side effect of replacing
          // every section wholesale — now that the row survives, there's no
          // reason an unrelated edit should throw away what the customer
          // already picked.
          await tx.quoteSection.update({ where: { id: section.id }, data });
        } else {
          await tx.quoteSection.create({ data: { ...data, quoteId: id } });
        }
      }
    } else {
      await tx.quoteSection.deleteMany({ where: { quoteId: id } });
    }

    return updated;
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
  // A quote with no lead has nowhere to log its own history — no activity
  // trail, no funnel, no automatic PROPOSAL/WON/LOST — so sending one is a
  // commitment this CRM then can't track. Creating and drafting without a
  // lead still stays free; this only stops it the moment it goes out.
  if (to === QuoteStatus.SENT && !current.leadId) {
    return { ok: false as const, reason: "no-lead" as const };
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
