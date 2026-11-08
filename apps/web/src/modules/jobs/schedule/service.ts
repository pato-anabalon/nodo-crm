import type { CompanyContext } from "@/lib/auth/session";
import { zonedInstant } from "@/lib/zoned-time";
import { JobActivityType, JobStatus, NotificationKind, type Prisma } from "@/generated/prisma/client";
import { notifyEach } from "@/modules/notifications/inbox";
import { emailJobNotice } from "../emails";
import { deleteStored, type UploadedFile } from "../files-service";
import { logJobActivity } from "../service";
import { jobVisibilityWhere } from "../scope";
import { dayKey } from "../schemas";
import { jobName, membersAmong, recipientsOnJob } from "../recipients";
import { addComment, commenters, commentThreadArgs, notifyConversation, type CommentOutcome } from "../comments/service";
import { commentHref } from "../comments/subject";
import { newlyAssigned } from "../todos/rules";
import type { EventValues } from "./schemas";

/**
 * The Schedule: a job's events, and the Lineup that lays every job out side
 * by side.
 *
 * Every function inside a job takes the `jobId` the caller confirmed through
 * `requireJobContext` — for an event, the one read from its row.
 */

const personSelect = { id: true, name: true, email: true, image: true } as const;

/** A stored day as a date at midnight UTC — the shape `@db.Date` columns compare against. */
function asDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

const eventRowSelect = {
  id: true,
  title: true,
  allDay: true,
  startsOn: true,
  endsOn: true,
  startsAt: true,
  endsAt: true,
  isMilestone: true,
  participants: { orderBy: { createdAt: "asc" }, select: { user: { select: personSelect } } },
  _count: { select: { comments: true } },
} as const;

/** Events touching the days `from`–`to`, inclusive. */
export async function eventsBetween(ctx: CompanyContext, jobId: string, from: string, to: string) {
  return ctx.db.jobEvent.findMany({
    where: { jobId, startsOn: { lte: asDate(to) }, endsOn: { gte: asDate(from) } },
    orderBy: [{ startsOn: "asc" }, { startsAt: "asc" }, { createdAt: "asc" }],
    select: eventRowSelect,
  });
}

export type EventRow = Awaited<ReturnType<typeof eventsBetween>>[number];

/**
 * Open to-dos due in those days. The Schedule shows them beside the events, as
 * Basecamp does: a due date is a date on the job's calendar whoever set it.
 */
export async function todosDueBetween(ctx: CompanyContext, jobId: string, from: string, to: string) {
  return ctx.db.jobTodo.findMany({
    where: { jobId, completedAt: null, dueOn: { gte: asDate(from), lte: asDate(to) } },
    orderBy: [{ dueOn: "asc" }, { position: "asc" }],
    select: { id: true, title: true, dueOn: true },
  });
}

/** The next few, for the card on the job's page. */
export async function upcomingEvents(ctx: CompanyContext, jobId: string, today: string, take = 3) {
  const where = { jobId, endsOn: { gte: asDate(today) } };
  const [events, count] = await Promise.all([
    ctx.db.jobEvent.findMany({
      where,
      orderBy: [{ startsOn: "asc" }, { startsAt: "asc" }],
      take,
      select: { id: true, title: true, allDay: true, startsOn: true, endsOn: true, startsAt: true, isMilestone: true },
    }),
    ctx.db.jobEvent.count({ where }),
  ]);
  return { events, count };
}

export async function getEvent(ctx: CompanyContext, jobId: string, eventId: string) {
  return ctx.db.jobEvent.findFirst({
    where: { id: eventId, jobId },
    select: {
      ...eventRowSelect,
      notes: true,
      createdAt: true,
      createdBy: { select: personSelect },
      comments: commentThreadArgs,
    },
  });
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEvent>>>;

/** An event as the guards need it. */
export async function findEvent(ctx: CompanyContext, eventId: string) {
  return ctx.db.jobEvent.findFirst({
    where: { id: eventId },
    select: { id: true, jobId: true, title: true, createdById: true },
  });
}

/** The days and, for a timed event, the instants — read on the company's own clocks. */
function eventTimes(values: EventValues, timeZone: string) {
  return {
    allDay: values.allDay,
    startsOn: asDate(values.startsOn),
    endsOn: asDate(values.endsOn),
    startsAt: values.allDay ? null : zonedInstant(values.startsOn, values.startTime!, timeZone),
    endsAt: values.allDay ? null : zonedInstant(values.endsOn, values.endTime!, timeZone),
  };
}

export async function createEvent(
  ctx: CompanyContext,
  jobId: string,
  values: EventValues,
  participantIds: string[],
): Promise<string> {
  const people = await membersAmong(ctx, jobId, participantIds);
  const event = await ctx.db.jobEvent.create({
    data: {
      companyId: ctx.company.id,
      jobId,
      title: values.title,
      notes: values.notes,
      isMilestone: values.isMilestone,
      ...eventTimes(values, ctx.company.timezone),
      createdById: ctx.user.id,
      participants: { create: people.map((userId) => ({ companyId: ctx.company.id, userId })) },
    },
    select: { id: true },
  });
  await logJobActivity(ctx, jobId, JobActivityType.EVENT_CREATED, {
    eventId: event.id,
    title: values.title,
    startsOn: values.startsOn,
  });
  await notifyParticipants(ctx, jobId, event.id, values.title, people);
  return event.id;
}

/** Saves changes; only people newly put on it hear about it. */
export async function updateEvent(
  ctx: CompanyContext,
  event: { id: string; jobId: string },
  values: EventValues,
  participantIds: string[],
): Promise<void> {
  const people = await membersAmong(ctx, event.jobId, participantIds);
  const before = await ctx.db.jobEventParticipant.findMany({ where: { eventId: event.id }, select: { userId: true } });
  const beforeIds = before.map((row) => row.userId);
  const added = newlyAssigned(beforeIds, people);
  const removed = beforeIds.filter((id) => !people.includes(id));

  await ctx.db.jobEvent.update({
    where: { id: event.id },
    data: {
      title: values.title,
      notes: values.notes,
      isMilestone: values.isMilestone,
      ...eventTimes(values, ctx.company.timezone),
    },
  });
  if (removed.length > 0) await ctx.db.jobEventParticipant.deleteMany({ where: { eventId: event.id, userId: { in: removed } } });
  if (added.length > 0) {
    await ctx.db.jobEventParticipant.createMany({
      data: added.map((userId) => ({ companyId: ctx.company.id, eventId: event.id, userId })),
      skipDuplicates: true,
    });
  }
  await notifyParticipants(ctx, event.jobId, event.id, values.title, added);
}

async function notifyParticipants(ctx: CompanyContext, jobId: string, eventId: string, title: string, userIds: string[]) {
  const recipients = await recipientsOnJob(ctx, jobId, userIds, "schedule.read");
  if (recipients.length === 0) return;
  const params = { by: ctx.user.name ?? ctx.user.email, job: await jobName(ctx, jobId), title };
  const raised = await notifyEach(recipients, {
    companyId: ctx.company.id,
    kind: NotificationKind.JOB_EVENT,
    params,
    href: `/jobs/${jobId}/schedule/${eventId}`,
  });
  emailJobNotice(ctx, { userIds: raised, template: "event", params, path: `/jobs/${jobId}/schedule/${eventId}` });
}

/** Deletes an event with its comments and their files, and its lines on the timeline. */
export async function deleteEvent(ctx: CompanyContext, jobId: string, eventId: string): Promise<void> {
  const files = await ctx.db.jobFile.findMany({
    where: { jobId, comment: { eventId } },
    select: { url: true, thumbnailUrl: true },
  });
  await ctx.db.jobEvent.deleteMany({ where: { id: eventId, jobId } });
  await ctx.db.jobActivity.deleteMany({ where: { jobId, params: { path: ["eventId"], equals: eventId } } });
  await deleteStored(files);
}

/** A comment on an event: heard about by whoever put it there, the people on it, and earlier commenters. */
export async function createEventComment(
  ctx: CompanyContext,
  event: { id: string; jobId: string; title: string; createdById: string | null },
  body: string,
  uploads: UploadedFile[],
): Promise<CommentOutcome> {
  const outcome = await addComment(ctx, event.jobId, { eventId: event.id }, body, uploads);
  if (!outcome.ok) return outcome;

  await logJobActivity(ctx, event.jobId, JobActivityType.EVENT_COMMENTED, {
    eventId: event.id,
    commentId: outcome.commentId,
    title: event.title,
  });
  const participants = await ctx.db.jobEventParticipant.findMany({ where: { eventId: event.id }, select: { userId: true } });
  await notifyConversation(ctx, {
    jobId: event.jobId,
    people: [event.createdById, ...participants.map((row) => row.userId), ...(await commenters(ctx, { eventId: event.id }))],
    permission: "schedule.read",
    title: event.title,
    href: commentHref(event.jobId, { kind: "event", id: event.id }, outcome.commentId),
  });
  return outcome;
}

// ---------------------------------------------------------------------------
// Lineup
// ---------------------------------------------------------------------------

export type LineupFilter = {
  /** `active` is under way or paused; `all` adds the finished and archived. */
  status: "active" | "all";
  memberId: string | null;
  tradeId: string | null;
};

/**
 * Every job this person may see that touches the window, with its dates —
 * plus, separately, the ones with no dates at all, which are on nobody's plan
 * yet and are worth saying so. The same visibility rule as everywhere else:
 * a Worker sees the bars of their own jobs.
 */
export async function lineupJobs(ctx: CompanyContext, filter: LineupFilter, from: string, to: string) {
  const where: Prisma.JobWhereInput = {
    ...jobVisibilityWhere(ctx.user.id, ctx.permissions),
    ...(filter.status === "active" ? { status: { in: [JobStatus.ACTIVE, JobStatus.ON_HOLD] } } : {}),
    AND: [
      ...(filter.memberId ? [{ members: { some: { userId: filter.memberId } } }] : []),
      ...(filter.tradeId
        ? [
            {
              members: {
                some: {
                  user: {
                    memberships: { some: { companyId: ctx.company.id, trades: { some: { tradeId: filter.tradeId } } } },
                  },
                },
              },
            },
          ]
        : []),
    ],
  };
  const select = { id: true, name: true, status: true, color: true, startsOn: true, endsOn: true } as const;

  const [dated, undated] = await Promise.all([
    ctx.db.job.findMany({
      where: {
        ...where,
        OR: [
          { startsOn: { lte: asDate(to) }, endsOn: { gte: asDate(from) } },
          { startsOn: null, endsOn: { gte: asDate(from), lte: asDate(to) } },
          { endsOn: null, startsOn: { gte: asDate(from), lte: asDate(to) } },
        ],
      },
      orderBy: [{ startsOn: "asc" }, { endsOn: "asc" }, { name: "asc" }],
      select,
    }),
    ctx.db.job.findMany({ where: { ...where, startsOn: null, endsOn: null }, orderBy: { createdAt: "desc" }, select }),
  ]);
  return {
    dated: dated.map((job) => ({ ...job, startsOn: dayKey(job.startsOn), endsOn: dayKey(job.endsOn) })),
    undated,
  };
}

/** The milestones of these jobs in the window — the diamonds over their bars. */
export async function lineupMilestones(ctx: CompanyContext, jobIds: string[], from: string, to: string) {
  if (jobIds.length === 0) return [];
  const rows = await ctx.db.jobEvent.findMany({
    where: { jobId: { in: jobIds }, isMilestone: true, startsOn: { gte: asDate(from), lte: asDate(to) } },
    orderBy: { startsOn: "asc" },
    select: { id: true, jobId: true, title: true, startsOn: true },
  });
  return rows.map((row) => ({ ...row, startsOn: dayKey(row.startsOn)! }));
}

/** Who the Lineup can be filtered by: active people in the company, and its trades. */
export async function lineupFilterOptions(ctx: CompanyContext) {
  const [people, trades] = await Promise.all([
    ctx.db.membership.findMany({
      where: { status: "ACTIVE" },
      orderBy: { user: { name: "asc" } },
      select: { user: { select: personSelect } },
    }),
    ctx.db.trade.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return { people: people.map((row) => row.user), trades };
}
