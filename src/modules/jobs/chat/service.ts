import type { CompanyContext } from "@/lib/auth/session";
import { JobActivityType, NotificationKind } from "@/generated/prisma/enums";
import { zonedInstant } from "@/lib/zoned-time";
import { notifyEach } from "@/modules/notifications/inbox";
import { attachFiles, deleteStored, jobFileSelect, type UploadedFile } from "../files-service";
import { jobName, recipientsOnJob } from "../recipients";
import { addDays } from "../schedule/calendar";
import { dayIn } from "../timeline";
import { personName } from "../avatars";
import { chatExcerpt, mentionedIn, type Mentionable } from "./text";

/**
 * The job's Chat. Messages are written and deleted, never edited — there is
 * no `chat.update` — and read a page at a time, newest last.
 */

/** How many messages a page holds: the first screen, and each "show earlier". */
export const CHAT_PAGE = 50;

const personSelect = { id: true, name: true, email: true, image: true } as const;

const messageSelect = {
  id: true,
  body: true,
  mentionIds: true,
  authorId: true,
  createdAt: true,
  author: { select: personSelect },
  files: { orderBy: { createdAt: "asc" }, select: jobFileSelect },
} as const;

export type ChatPage = {
  messages: Awaited<ReturnType<typeof readPage>>["rows"];
  /** The people those messages mention, to draw their names as mentions. */
  mentioned: Mentionable[];
  hasEarlier: boolean;
};

async function readPage(ctx: CompanyContext, jobId: string, before: Date | null) {
  const rows = await ctx.db.jobChatMessage.findMany({
    where: { jobId, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: CHAT_PAGE + 1,
    select: messageSelect,
  });
  return { rows: rows.slice(0, CHAT_PAGE).reverse(), hasEarlier: rows.length > CHAT_PAGE };
}

/**
 * The latest page, or the page before a message already on screen. A cursor
 * that isn't a message of this job reads as "nothing earlier" rather than as
 * the latest page again, which would loop.
 */
export async function chatPage(ctx: CompanyContext, jobId: string, beforeId: string | null = null): Promise<ChatPage> {
  let before: Date | null = null;
  if (beforeId) {
    const cursor = await ctx.db.jobChatMessage.findFirst({ where: { id: beforeId, jobId }, select: { createdAt: true } });
    if (!cursor) return { messages: [], mentioned: [], hasEarlier: false };
    before = cursor.createdAt;
  }
  const { rows, hasEarlier } = await readPage(ctx, jobId, before);
  const ids = [...new Set(rows.flatMap((row) => row.mentionIds))];
  // By user rather than membership: somebody mentioned and since taken off the
  // job was still mentioned.
  const users = ids.length ? await ctx.db.user.findMany({ where: { id: { in: ids } }, select: personSelect }) : [];
  return { messages: rows, mentioned: users.map((user) => ({ id: user.id, name: personName(user) })), hasEarlier };
}

export type ChatRow = ChatPage["messages"][number];

/** The people on the job, as the `@` list offers them. */
export async function mentionablePeople(ctx: CompanyContext, jobId: string): Promise<Mentionable[]> {
  const members = await ctx.db.jobMember.findMany({
    where: { jobId },
    select: { user: { select: personSelect } },
  });
  return members
    .map((member) => ({ id: member.user.id, name: personName(member.user) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function findChatMessage(ctx: CompanyContext, messageId: string) {
  return ctx.db.jobChatMessage.findFirst({
    where: { id: messageId },
    select: { id: true, jobId: true, authorId: true, createdAt: true },
  });
}

export type SendOutcome = { ok: true; messageId: string } | { ok: false; reason: "empty" | "files" };

/**
 * Writes a message with its files, then the timeline line and the mentions.
 * If a file is refused the message is taken back out, so nothing half-sent
 * stays behind.
 */
export async function sendChatMessage(
  ctx: CompanyContext,
  jobId: string,
  body: string,
  uploads: UploadedFile[],
): Promise<SendOutcome> {
  if (!body && uploads.length === 0) return { ok: false, reason: "empty" };

  const people = await mentionablePeople(ctx, jobId);
  const mentionIds = mentionedIn(body, people);
  const message = await ctx.db.jobChatMessage.create({
    data: { companyId: ctx.company.id, jobId, body, mentionIds, authorId: ctx.user.id },
    select: { id: true, createdAt: true },
  });
  if (!(await attachFiles(ctx, jobId, { chatMessageId: message.id }, uploads))) {
    await ctx.db.jobChatMessage.deleteMany({ where: { id: message.id } });
    return { ok: false, reason: "files" };
  }

  await recountChatLine(ctx, jobId, ctx.user.id, dayIn(message.createdAt, ctx.company.timezone), true);
  await notifyMentions(ctx, jobId, message.id, body, mentionIds);
  return { ok: true, messageId: message.id };
}

/**
 * Only the people mentioned hear about a message, and only those still on the
 * job who read its chat. A notice for every line would be a bell nobody reads.
 */
async function notifyMentions(ctx: CompanyContext, jobId: string, messageId: string, body: string, mentionIds: string[]) {
  const recipients = await recipientsOnJob(ctx, jobId, mentionIds, "chat.read");
  if (recipients.length === 0) return;
  await notifyEach(recipients, {
    companyId: ctx.company.id,
    kind: NotificationKind.JOB_CHAT_MENTION,
    params: { by: ctx.user.name ?? ctx.user.email, job: await jobName(ctx, jobId), excerpt: chatExcerpt(body) },
    href: `/jobs/${jobId}/chat#message-${messageId}`,
  });
}

/** Deletes a message with its files, and recounts its author's line for that day. */
export async function deleteChatMessage(
  ctx: CompanyContext,
  message: { id: string; jobId: string; authorId: string | null; createdAt: Date },
): Promise<void> {
  const files = await ctx.db.jobFile.findMany({ where: { chatMessageId: message.id }, select: { url: true, thumbnailUrl: true } });
  await ctx.db.jobChatMessage.deleteMany({ where: { id: message.id, jobId: message.jobId } });
  if (message.authorId) {
    await recountChatLine(ctx, message.jobId, message.authorId, dayIn(message.createdAt, ctx.company.timezone), false);
  }
  await deleteStored(files);
}

/**
 * The timeline carries one line per person per day of chat — "Ana sent 12
 * messages in the chat" — rather than a line per message, which would bury
 * everything else on it.
 *
 * The count is read back from the messages each time rather than added to,
 * so two messages sent at once, or one deleted, can't leave it wrong. Sending
 * moves the line up to now, where the latest message is; deleting leaves it
 * where it was, and takes it away when that day has nothing left.
 */
async function recountChatLine(ctx: CompanyContext, jobId: string, authorId: string, day: string, bump: boolean) {
  const { timezone } = ctx.company;
  const count = await ctx.db.jobChatMessage.count({
    where: {
      jobId,
      authorId,
      createdAt: { gte: zonedInstant(day, "00:00", timezone), lt: zonedInstant(addDays(day, 1), "00:00", timezone) },
    },
  });
  const where = { jobId, actorId: authorId, type: JobActivityType.CHAT_MESSAGES, params: { path: ["day"], equals: day } };
  if (count === 0) {
    await ctx.db.jobActivity.deleteMany({ where });
    return;
  }
  const line = await ctx.db.jobActivity.findFirst({ where, select: { id: true } });
  if (line) {
    await ctx.db.jobActivity.update({
      where: { id: line.id },
      data: { params: { day, count }, ...(bump ? { createdAt: new Date() } : {}) },
    });
  } else if (bump) {
    await ctx.db.jobActivity.create({
      data: { companyId: ctx.company.id, jobId, actorId: authorId, type: JobActivityType.CHAT_MESSAGES, params: { day, count } },
    });
  }
}

/** How many messages, and the last few — the Chat card on the job's page. */
export async function chatSummary(ctx: CompanyContext, jobId: string) {
  const [count, latest] = await Promise.all([
    ctx.db.jobChatMessage.count({ where: { jobId } }),
    ctx.db.jobChatMessage.findMany({
      where: { jobId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
      select: { id: true, body: true, author: { select: personSelect }, _count: { select: { files: true } } },
    }),
  ]);
  return { count, latest };
}
