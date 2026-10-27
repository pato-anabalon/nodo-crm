import type { CompanyContext } from "@/lib/auth/session";
import { LeadAccessKind } from "@/generated/prisma/enums";

/** A person opening the same lead again inside this window is the same visit. */
export const VIEW_WINDOW_MS = 30 * 60 * 1000;

/** How many entries the lead's access log shows. */
export const ACCESS_LOG_LIMIT = 50;

/** The lead's own fields whose changes are worth a line in the log. */
export const TRACKED_FIELDS = [
  "title",
  "description",
  "status",
  "source",
  "sourceDetail",
  "score",
  "estimatedValue",
  "contactName",
  "contactEmail",
  "contactPhone",
  "companyName",
  "contactId",
  "ownerId",
  "lostReason",
] as const;

/** Everything a log line may name: the lead's fields, plus its attached files. */
export const LOGGED_FIELDS = [...TRACKED_FIELDS, "files"] as const;

type Tracked = Partial<Record<(typeof TRACKED_FIELDS)[number], unknown>>;

/** Whether a new view should be written, given the same person's last one. */
export function isNewVisit(lastViewAt: Date | null, now: Date): boolean {
  return !lastViewAt || now.getTime() - lastViewAt.getTime() >= VIEW_WINDOW_MS;
}

/**
 * The names of the fields that differ — never the values. The log says who
 * touched what and when; what it used to say is not something to keep copying
 * into another table (an email address, a phone number).
 */
export function changedLeadFields(before: Tracked, after: Tracked): string[] {
  const same = (a: unknown, b: unknown) => String(a ?? "") === String(b ?? "");
  return TRACKED_FIELDS.filter((field) => !same(before[field], after[field]));
}

export async function recordLeadView(ctx: CompanyContext, leadId: string, now = new Date()) {
  const last = await ctx.db.leadAccessLog.findFirst({
    where: { leadId, userId: ctx.user.id, kind: LeadAccessKind.VIEWED },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!isNewVisit(last?.createdAt ?? null, now)) return;

  await ctx.db.leadAccessLog.create({
    data: { companyId: ctx.company.id, leadId, userId: ctx.user.id, kind: LeadAccessKind.VIEWED },
  });
}

export async function recordLeadUpdate(ctx: CompanyContext, leadId: string, detail: string | null) {
  await ctx.db.leadAccessLog.create({
    data: { companyId: ctx.company.id, leadId, userId: ctx.user.id, kind: LeadAccessKind.UPDATED, detail },
  });
}

export async function listLeadAccessLog(ctx: CompanyContext, leadId: string) {
  return ctx.db.leadAccessLog.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: ACCESS_LOG_LIMIT,
    include: { user: { select: { name: true, email: true } } },
  });
}
