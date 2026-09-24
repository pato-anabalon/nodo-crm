import type { CompanyContext } from "@/lib/auth/session";
import { ActivityType, LeadStatus, Prisma } from "@/generated/prisma/client";
import { NotificationKind } from "@/generated/prisma/enums";
import { notify } from "@/modules/notifications/inbox";
import { isClosedStatus } from "./constants";
import type { LeadFilters, LeadFormValues } from "./schemas";

export const LEADS_PAGE_SIZE = 20;

/**
 * Visibility limits within the company.
 *
 * Isolation between companies is already guaranteed by `ctx.db`; this is the
 * layer above it: a rep without `leads.read.all` sees only their own book.
 */
export function visibilityWhere(ctx: CompanyContext): Prisma.LeadWhereInput {
  if (ctx.permissions.has("leads.read.all")) return {};
  return { ownerId: ctx.user.id };
}

export function buildLeadWhere(ctx: CompanyContext, filters: LeadFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { ...visibilityWhere(ctx) };
  const and: Prisma.LeadWhereInput[] = [];

  // Discarded leads leave the inbox but not the database: they only show up when
  // explicitly asked for.
  and.push(filters.discarded ? { NOT: { discardedAt: null } } : { discardedAt: null });

  if (filters.status) and.push({ status: filters.status });
  if (filters.ownerId) and.push({ ownerId: filters.ownerId });

  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { contactEmail: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

export async function listLeads(ctx: CompanyContext, filters: LeadFilters) {
  const where = buildLeadWhere(ctx, filters);
  const skip = (filters.page - 1) * LEADS_PAGE_SIZE;

  const [items, total] = await Promise.all([
    ctx.db.lead.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: LEADS_PAGE_SIZE,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { quotes: true } },
      },
    }),
    ctx.db.lead.count({ where }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE)),
  };
}

export async function getLead(ctx: CompanyContext, id: string) {
  return ctx.db.lead.findFirst({
    where: { id, ...visibilityWhere(ctx) },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      discardedBy: { select: { id: true, name: true, email: true } },
      // What arrived from the form, verbatim: shown without editing.
      submission: true,
      contact: true,
      quotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, title: true, status: true, total: true, currency: true },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
}

export async function createLead(ctx: CompanyContext, values: LeadFormValues) {
  // Without permission to assign, the lead stays with whoever created it.
  const ownerId = ctx.permissions.has("leads.assign")
    ? values.ownerId ?? ctx.user.id
    : ctx.user.id;

  const lead = await ctx.db.lead.create({
    data: {
      // `ctx.db` already injects the company at runtime; it's declared anyway
      // because Prisma's generated types demand it, and that way the compiler
      // also makes sure no create slips through without a company.
      companyId: ctx.company.id,
      title: values.title,
      description: values.description ?? null,
      status: values.status,
      source: values.source,
      score: values.score,
      estimatedValue: values.estimatedValue ?? null,
      currency: ctx.company.currency,
      contactName: values.contactName ?? null,
      contactEmail: values.contactEmail ?? null,
      contactPhone: values.contactPhone ?? null,
      companyName: values.companyName ?? null,
      ownerId,
      closedAt: isClosedStatus(values.status) ? new Date() : null,
    },
  });

  // The content stays empty: the visible text comes from the type, translated in
  // the UI. Only notes written by a person carry content of their own.
  await ctx.db.activity.create({
    data: {
      companyId: ctx.company.id,
      leadId: lead.id,
      userId: ctx.user.id,
      type: ActivityType.RECEIVED,
      content: "",
    },
  });

  return lead;
}

export async function updateLead(ctx: CompanyContext, id: string, values: LeadFormValues) {
  const current = await ctx.db.lead.findFirst({
    where: { id, ...visibilityWhere(ctx) },
    select: { id: true, status: true, ownerId: true },
  });
  if (!current) return null;

  const ownerId = ctx.permissions.has("leads.assign") ? values.ownerId ?? null : current.ownerId;
  const statusChanged = current.status !== values.status;

  const lead = await ctx.db.lead.update({
    where: { id },
    data: {
      title: values.title,
      description: values.description ?? null,
      status: values.status,
      source: values.source,
      score: values.score,
      estimatedValue: values.estimatedValue ?? null,
      contactName: values.contactName ?? null,
      contactEmail: values.contactEmail ?? null,
      contactPhone: values.contactPhone ?? null,
      companyName: values.companyName ?? null,
      lostReason: values.status === LeadStatus.LOST ? values.lostReason ?? null : null,
      ownerId,
      // Reopening a closed lead clears the closing date.
      closedAt: isClosedStatus(values.status) ? new Date() : null,
    },
  });

  if (statusChanged) {
    await ctx.db.activity.create({
      data: {
        companyId: ctx.company.id,
        leadId: lead.id,
        userId: ctx.user.id,
        type: ActivityType.STATUS_CHANGE,
        // Both statuses, kept apart: the UI translates them for whoever reads it.
        content: `${current.status}>${values.status}`,
      },
    });
  }

  return lead;
}

export async function deleteLead(ctx: CompanyContext, id: string) {
  const { count } = await ctx.db.lead.deleteMany({ where: { id } });
  return count > 0;
}

/** Every action in the flow lands in the activity log with its author and time. */
async function logActivity(
  ctx: CompanyContext,
  leadId: string,
  type: ActivityType,
  content: string,
) {
  return ctx.db.activity.create({
    data: { companyId: ctx.company.id, leadId, userId: ctx.user.id, type, content },
  });
}

export async function assignLead(ctx: CompanyContext, id: string, ownerId: string | null) {
  const lead = await ctx.db.lead.findFirst({
    where: { id, ...visibilityWhere(ctx) },
    select: { id: true, ownerId: true },
  });
  if (!lead) return null;
  if (lead.ownerId === ownerId) return lead;

  // The name is stored, not the id: the log has to stay readable even if that
  // person later leaves the company.
  const owner = ownerId
    ? await ctx.db.membership.findFirst({
        where: { userId: ownerId },
        select: { user: { select: { name: true, email: true } } },
      })
    : null;

  const [updated] = await Promise.all([
    ctx.db.lead.update({ where: { id }, data: { ownerId: owner ? ownerId : null } }),
    logActivity(ctx, id, ActivityType.ASSIGNED, owner?.user.name ?? owner?.user.email ?? ""),
  ]);

  // Raised here and not in the action because this is the only place that knows
  // the owner actually changed — reassigning to the same person says nothing.
  // Handing a lead to yourself is not news to you either.
  if (ownerId && ownerId !== ctx.user.id) {
    await notify({
      companyId: ctx.company.id,
      userId: ownerId,
      kind: NotificationKind.LEAD_ASSIGNED,
      params: { title: updated.title, by: ctx.user.name ?? ctx.user.email },
      href: `/leads/${id}`,
    });
  }

  return updated;
}

/**
 * Discarding doesn't delete: it takes the lead out of the inbox but keeps
 * everything, because why something was discarded is commercial information.
 */
export async function discardLead(ctx: CompanyContext, id: string, reason: string | null) {
  const lead = await ctx.db.lead.findFirst({
    where: { id, ...visibilityWhere(ctx), discardedAt: null },
    select: { id: true },
  });
  if (!lead) return null;

  const [updated] = await Promise.all([
    ctx.db.lead.update({
      where: { id },
      data: { discardedAt: new Date(), discardedById: ctx.user.id, discardReason: reason },
    }),
    logActivity(ctx, id, ActivityType.DISCARDED, reason ?? ""),
  ]);
  return updated;
}

export async function restoreLead(ctx: CompanyContext, id: string) {
  const lead = await ctx.db.lead.findFirst({
    where: { id, ...visibilityWhere(ctx), NOT: { discardedAt: null } },
    select: { id: true },
  });
  if (!lead) return null;

  const [updated] = await Promise.all([
    ctx.db.lead.update({
      where: { id },
      data: { discardedAt: null, discardedById: null, discardReason: null },
    }),
    logActivity(ctx, id, ActivityType.RESTORED, ""),
  ]);
  return updated;
}

/** Records on the lead that a quote was issued from it. */
export async function logLeadConverted(ctx: CompanyContext, leadId: string, reference: string) {
  return logActivity(ctx, leadId, ActivityType.CONVERTED, reference);
}

export async function addLeadNote(ctx: CompanyContext, leadId: string, content: string) {
  const lead = await ctx.db.lead.findFirst({
    where: { id: leadId, ...visibilityWhere(ctx) },
    select: { id: true },
  });
  if (!lead) return null;

  return ctx.db.activity.create({
    data: { companyId: ctx.company.id, leadId, userId: ctx.user.id, type: ActivityType.NOTE, content },
  });
}

/** Count per status for the pipeline summary. */
export async function leadPipelineSummary(ctx: CompanyContext) {
  const rows = await ctx.db.lead.groupBy({
    by: ["status"],
    where: { ...visibilityWhere(ctx), discardedAt: null },
    _count: { _all: true },
    _sum: { estimatedValue: true },
  });

  return rows.map((row) => ({
    status: row.status,
    count: row._count._all,
    value: Number(row._sum.estimatedValue ?? 0),
  }));
}
