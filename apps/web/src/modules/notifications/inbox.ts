import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotificationKind, Prisma } from "@/generated/prisma/client";
import { wantsNotice } from "./preferences";

/** How many the bell holds. Past this it's a report, not a notice. */
export const INBOX_LIMIT = 30;

export type NotifyInput = {
  companyId: string;
  userId: string;
  kind: NotificationKind;
  params?: Record<string, string | number>;
  href?: string | null;
  /**
   * Set for anything that can be true more than once — a task overdue for a
   * week, a form failing all afternoon. Without it the bell fills with the same
   * sentence and people stop looking at it.
   */
  dedupeKey?: string | null;
};

/**
 * Drops one notice into a person's bell.
 *
 * Goes through `prisma` rather than `ctx.db`: the recipient is usually somebody
 * other than whoever caused the event, and `companyId` is passed explicitly and
 * comes from the record that triggered it.
 */
/** Returns whether a new notice was actually raised, so a caller can send
 * the matching email exactly once even if the sweep runs twice. */
export async function notify(input: NotifyInput): Promise<boolean> {
  // The same opt-out that governs the emails governs the bell: a notice
  // somebody turned off should stop arriving, not change doorway.
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: input.userId, companyId: input.companyId },
    select: { kind: true, enabled: true },
  });
  if (!wantsNotice(preferences, input.kind)) return false;

  const data = {
    companyId: input.companyId,
    userId: input.userId,
    kind: input.kind,
    params: (input.params ?? {}) as Prisma.InputJsonValue,
    href: input.href ?? null,
    dedupeKey: input.dedupeKey ?? null,
  };

  if (!input.dedupeKey) {
    await prisma.notification.create({ data });
    return true;
  }

  // Seen before: leave the original where it is rather than pushing it back to
  // the top, so an old unread notice doesn't keep resurfacing.
  const where = {
    userId_companyId_dedupeKey: {
      userId: input.userId,
      companyId: input.companyId,
      dedupeKey: input.dedupeKey,
    },
  };

  const existing = await prisma.notification.findUnique({ where, select: { id: true } });
  if (existing) return false;

  await prisma.notification.upsert({ where, create: data, update: {} });
  return true;
}

/** The same notice for several people, each with their own row. */
export async function notifyEach(
  userIds: string[],
  input: Omit<NotifyInput, "userId">,
): Promise<string[]> {
  const raised: string[] = [];
  for (const userId of [...new Set(userIds)]) {
    if (await notify({ ...input, userId })) raised.push(userId);
  }
  return raised;
}

export async function listInbox(ctx: CompanyContext) {
  return ctx.db.notification.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: INBOX_LIMIT,
  });
}

export async function unreadCount(ctx: CompanyContext): Promise<number> {
  return ctx.db.notification.count({ where: { userId: ctx.user.id, readAt: null } });
}

export async function markRead(ctx: CompanyContext, id: string): Promise<void> {
  await ctx.db.notification.updateMany({
    where: { id, userId: ctx.user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(ctx: CompanyContext): Promise<number> {
  const { count } = await ctx.db.notification.updateMany({
    where: { userId: ctx.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}
