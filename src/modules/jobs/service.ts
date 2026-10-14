import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  ActivityType,
  JobActivityType,
  JobStatus,
  MembershipStatus,
  NotificationKind,
  Prisma,
  QuoteStatus,
} from "@/generated/prisma/client";
import { formatQuoteNumber } from "@/lib/format";
import { notifyEach } from "@/modules/notifications/inbox";
import { jobNameFromQuote } from "./naming";
import { jobVisibilityWhere } from "./scope";
import { activityPermission } from "./timeline";
import { dayKey, type JobDates, type JobFormValues, type JobListFilter } from "./schemas";

const OPEN_STATUSES: JobStatus[] = [JobStatus.ACTIVE, JobStatus.ON_HOLD];
const DONE_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.ARCHIVED];

export function visibleJobs(ctx: CompanyContext): Prisma.JobWhereInput {
  return jobVisibilityWhere(ctx.user.id, ctx.permissions);
}

const personSelect = { id: true, name: true, email: true, image: true } as const;

export async function listJobs(ctx: CompanyContext, filter: JobListFilter) {
  return ctx.db.job.findMany({
    where: {
      ...visibleJobs(ctx),
      status: { in: filter === "done" ? DONE_STATUSES : OPEN_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startsOn: true,
      endsOn: true,
      members: { orderBy: { createdAt: "asc" }, select: { user: { select: personSelect } } },
    },
  });
}

/**
 * The job itself, or null when it doesn't exist **or this person can't see
 * it** — the two are deliberately indistinguishable from outside.
 */
export async function getJob(ctx: CompanyContext, id: string) {
  return ctx.db.job.findFirst({
    where: { id, ...visibleJobs(ctx) },
    include: {
      quote: { select: { id: true, number: true } },
      members: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, following: true, user: { select: personSelect } },
      },
    },
  });
}

export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJob>>>;

/** The job started from a quote, if there is one this person can see. */
export async function jobForQuote(ctx: CompanyContext, quoteId: string) {
  return ctx.db.job.findFirst({ where: { quoteId, ...visibleJobs(ctx) }, select: { id: true } });
}

/** Whether the quote already has a job, seen or not — so "Start job" isn't offered twice. */
export async function quoteHasJob(ctx: CompanyContext, quoteId: string): Promise<boolean> {
  return (await ctx.db.job.count({ where: { quoteId } })) > 0;
}

/** The timeline's lines this profile may read: a tool taken away takes its lines with it. */
function readableActivity(ctx: CompanyContext): JobActivityType[] {
  return Object.values(JobActivityType).filter((type) => ctx.permissions.has(activityPermission(type)));
}

export async function jobActivity(ctx: CompanyContext, jobId: string, take = 100) {
  return ctx.db.jobActivity.findMany({
    where: { jobId, type: { in: readableActivity(ctx) } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      params: true,
      createdAt: true,
      actor: { select: personSelect },
    },
  });
}

/** The latest across every job this person can see — the side panel on /jobs. */
export async function recentJobActivity(ctx: CompanyContext, take = 15) {
  return ctx.db.jobActivity.findMany({
    where: { job: visibleJobs(ctx), type: { in: readableActivity(ctx) } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      params: true,
      createdAt: true,
      actor: { select: personSelect },
      job: { select: { id: true, name: true } },
    },
  });
}

export type JobActivityRow = Awaited<ReturnType<typeof jobActivity>>[number];

/** The people a job can be given: anyone active in the company and not on it yet. */
export async function memberCandidates(ctx: CompanyContext, jobId: string) {
  const memberships = await ctx.db.membership.findMany({
    where: { status: MembershipStatus.ACTIVE, user: { jobMemberships: { none: { jobId } } } },
    orderBy: { user: { name: "asc" } },
    select: {
      role: { select: { key: true, name: true } },
      user: { select: personSelect },
      trades: { select: { trade: { select: { name: true } } } },
    },
  });
  return memberships.map((m) => ({
    ...m.user,
    role: m.role,
    trades: m.trades.map((t) => t.trade.name),
  }));
}

/** The trades of the given people, at this company. */
export async function tradesByUser(ctx: CompanyContext, userIds: string[]) {
  const rows = await ctx.db.membership.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, role: { select: { key: true, name: true } }, trades: { select: { trade: { select: { name: true, position: true } } } } },
  });
  return new Map(
    rows.map((row) => [
      row.userId,
      {
        role: row.role,
        trades: row.trades
          .map((t) => t.trade)
          .sort((a, b) => a.position - b.position)
          .map((t) => t.name),
      },
    ]),
  );
}

export type StartJobOutcome =
  | { ok: true; jobId: string }
  | { ok: false; reason: "not-found" | "not-accepted" | "already-started"; jobId?: string };

/**
 * Turns an accepted quote into a job.
 *
 * Inside one transaction, through `prisma` with an explicit company — the
 * tenant extension doesn't travel into `$transaction`. `quoteId` is unique on
 * `Job`, so a second press (or two people pressing at once) lands on the
 * constraint rather than making a second job.
 */
export async function startJobFromQuote(ctx: CompanyContext, quoteId: string): Promise<StartJobOutcome> {
  const quote = await ctx.db.quote.findFirst({
    where: { id: quoteId },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      projectAddress: true,
      clientCompanyName: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      leadId: true,
      lead: { select: { ownerId: true } },
      job: { select: { id: true } },
    },
  });
  if (!quote) return { ok: false, reason: "not-found" };
  if (quote.job) return { ok: false, reason: "already-started", jobId: quote.job.id };
  if (quote.status !== QuoteStatus.ACCEPTED) return { ok: false, reason: "not-accepted" };

  const reference = formatQuoteNumber(ctx.company.quotePrefix, quote.number);
  const companyId = ctx.company.id;
  const memberIds = [...new Set([ctx.user.id, quote.lead?.ownerId].filter((id): id is string => Boolean(id)))];

  try {
    const job = await prisma.$transaction(async (tx) => {
      const job = await tx.job.create({
        data: {
          companyId,
          name: jobNameFromQuote({ projectAddress: quote.projectAddress, title: quote.title, reference }),
          description: clientSummary(quote),
          address: quote.projectAddress?.trim() || null,
          quoteId: quote.id,
          leadId: quote.leadId,
          createdById: ctx.user.id,
        },
        select: { id: true },
      });
      await tx.jobMember.createMany({
        data: memberIds.map((userId) => ({ companyId, jobId: job.id, userId, addedById: ctx.user.id })),
      });
      await tx.jobActivity.create({
        data: {
          companyId,
          jobId: job.id,
          actorId: ctx.user.id,
          type: JobActivityType.CREATED,
          params: { quoteNumber: reference },
        },
      });
      if (quote.leadId) {
        await tx.activity.create({
          data: {
            companyId,
            leadId: quote.leadId,
            userId: ctx.user.id,
            type: ActivityType.JOB_STARTED,
            content: String(quote.number),
          },
        });
      }
      return job;
    });

    await notifyAdded(ctx, job.id, memberIds);
    return { ok: true, jobId: job.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await ctx.db.job.findFirst({ where: { quoteId }, select: { id: true } });
      return { ok: false, reason: "already-started", jobId: existing?.id };
    }
    throw error;
  }
}

/**
 * Who the work is for, as it used to be typed by hand into the Basecamp
 * project: the customer's company, then the person and how to reach them.
 * Data only, no words — a description is read in whatever language the reader
 * works in.
 */
export function clientSummary(quote: {
  clientCompanyName: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
}): string | null {
  const person = [quote.clientName, quote.clientEmail, quote.clientPhone]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(" · ");
  const lines = [quote.clientCompanyName?.trim(), person].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : null;
}

/** A job that stands on its own, with no quote behind it. */
export async function createJob(ctx: CompanyContext, values: JobFormValues & JobDates): Promise<string> {
  const companyId = ctx.company.id;
  const job = await prisma.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        companyId,
        name: values.name,
        description: values.description ?? null,
        address: values.address ?? null,
        startsOn: values.startsOn,
        endsOn: values.endsOn,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await tx.jobMember.create({ data: { companyId, jobId: job.id, userId: ctx.user.id, addedById: ctx.user.id } });
    await tx.jobActivity.create({
      data: { companyId, jobId: job.id, actorId: ctx.user.id, type: JobActivityType.CREATED },
    });
    return job;
  });
  return job.id;
}

export async function updateJob(ctx: CompanyContext, jobId: string, values: JobFormValues): Promise<void> {
  await ctx.db.job.update({
    where: { id: jobId },
    data: { name: values.name, description: values.description ?? null, address: values.address ?? null },
  });
}

export async function setJobStatus(ctx: CompanyContext, jobId: string, to: JobStatus): Promise<boolean> {
  const job = await ctx.db.job.findFirst({ where: { id: jobId }, select: { status: true } });
  if (!job || job.status === to) return false;
  await ctx.db.job.update({ where: { id: jobId }, data: { status: to } });
  await logJobActivity(ctx, jobId, JobActivityType.STATUS_CHANGED, { from: job.status, to });
  return true;
}

export async function setJobDates(ctx: CompanyContext, jobId: string, dates: JobDates): Promise<boolean> {
  const job = await ctx.db.job.findFirst({ where: { id: jobId }, select: { startsOn: true, endsOn: true } });
  if (!job) return false;
  const unchanged =
    dayKey(job.startsOn) === dayKey(dates.startsOn) && dayKey(job.endsOn) === dayKey(dates.endsOn);
  if (unchanged) return false;
  await ctx.db.job.update({ where: { id: jobId }, data: { startsOn: dates.startsOn, endsOn: dates.endsOn } });
  await logJobActivity(ctx, jobId, JobActivityType.DATES_CHANGED, {
    startsOn: dayKey(dates.startsOn),
    endsOn: dayKey(dates.endsOn),
  });
  return true;
}

export async function deleteJob(ctx: CompanyContext, jobId: string): Promise<boolean> {
  const { count } = await ctx.db.job.deleteMany({ where: { id: jobId } });
  return count > 0;
}

/**
 * Puts people on a job. Only active members of this company can be added:
 * the ids come from a form, and a suspended account or somebody from another
 * company is filtered out here rather than trusted.
 */
export async function addJobMembers(ctx: CompanyContext, jobId: string, userIds: string[]): Promise<string[]> {
  const eligible = await ctx.db.membership.findMany({
    where: { userId: { in: userIds }, status: MembershipStatus.ACTIVE },
    select: { userId: true },
  });
  const existing = await ctx.db.jobMember.findMany({
    where: { jobId, userId: { in: eligible.map((m) => m.userId) } },
    select: { userId: true },
  });
  const already = new Set(existing.map((m) => m.userId));
  const added = eligible.map((m) => m.userId).filter((id) => !already.has(id));
  if (added.length === 0) return [];

  await ctx.db.jobMember.createMany({
    data: added.map((userId) => ({ companyId: ctx.company.id, jobId, userId, addedById: ctx.user.id })),
    skipDuplicates: true,
  });
  await logJobActivity(ctx, jobId, JobActivityType.MEMBERS_ADDED, { userIds: added });
  await notifyAdded(ctx, jobId, added);
  return added;
}

export async function removeJobMember(ctx: CompanyContext, jobId: string, userId: string): Promise<boolean> {
  const { count } = await ctx.db.jobMember.deleteMany({ where: { jobId, userId } });
  if (count === 0) return false;
  await logJobActivity(ctx, jobId, JobActivityType.MEMBER_REMOVED, { userId });
  return true;
}

/** Whether this person follows the job's notices. Their own choice, no permission needed. */
export async function setFollowing(ctx: CompanyContext, jobId: string, following: boolean): Promise<boolean> {
  const { count } = await ctx.db.jobMember.updateMany({
    where: { jobId, userId: ctx.user.id },
    data: { following },
  });
  return count > 0;
}

export async function logJobActivity(
  ctx: CompanyContext,
  jobId: string,
  type: JobActivityType,
  params: Prisma.InputJsonObject = {},
) {
  await ctx.db.jobActivity.create({
    data: { companyId: ctx.company.id, jobId, actorId: ctx.user.id, type, params },
  });
}

/** Being added to a job is news — except to whoever did the adding. */
async function notifyAdded(ctx: CompanyContext, jobId: string, userIds: string[]): Promise<void> {
  const recipients = userIds.filter((id) => id !== ctx.user.id);
  if (recipients.length === 0) return;
  const job = await ctx.db.job.findFirst({ where: { id: jobId }, select: { name: true } });
  if (!job) return;

  await notifyEach(recipients, {
    companyId: ctx.company.id,
    kind: NotificationKind.JOB_ADDED,
    params: { job: job.name, by: ctx.user.name ?? ctx.user.email },
    href: `/jobs/${jobId}`,
  });
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

export async function listTrades(ctx: CompanyContext) {
  return ctx.db.trade.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, _count: { select: { memberships: true } } },
  });
}

export type TradeOutcome = { ok: true } | { ok: false; reason: "duplicate" };

export async function createTrade(ctx: CompanyContext, name: string): Promise<TradeOutcome> {
  const clash = await ctx.db.trade.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) return { ok: false, reason: "duplicate" };
  const last = await ctx.db.trade.aggregate({ _max: { position: true } });
  await ctx.db.trade.create({
    data: { companyId: ctx.company.id, name, position: (last._max.position ?? -1) + 1 },
  });
  return { ok: true };
}

export async function deleteTrade(ctx: CompanyContext, id: string): Promise<boolean> {
  const { count } = await ctx.db.trade.deleteMany({ where: { id } });
  return count > 0;
}

/**
 * Replaces a person's trades at this company with exactly the ones ticked.
 * Trade ids are checked against the company's own list before anything is
 * written — the form posts ids, and the join table inherits its company only
 * through the membership.
 */
export async function setMemberTrades(ctx: CompanyContext, userId: string, tradeIds: string[]): Promise<boolean> {
  const membership = await ctx.db.membership.findFirst({ where: { userId }, select: { id: true } });
  if (!membership) return false;
  const trades = await ctx.db.trade.findMany({ where: { id: { in: tradeIds } }, select: { id: true } });

  await ctx.db.$transaction([
    ctx.db.membershipTrade.deleteMany({ where: { membershipId: membership.id } }),
    ctx.db.membershipTrade.createMany({
      data: trades.map((trade) => ({ membershipId: membership.id, tradeId: trade.id })),
    }),
  ]);
  return true;
}
