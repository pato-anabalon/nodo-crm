import { z } from "zod";
import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/rich-text";
import { JobActivityType, JobScopeChangeKind } from "@/generated/prisma/enums";

/**
 * The scope of work, changed on the job.
 *
 * It arrives copied from the quote and is the frame the work was sold in; what
 * gets agreed on site moves it. So it can be edited, by `scope.update`, and
 * every hand on it is kept: a `JobScopeChange` with what the line was and what
 * it became, written in the same transaction as the change, and a line on the
 * timeline for whoever reads it there. A deleted line keeps its history.
 *
 * Writes go through `prisma.$transaction` with an explicit `companyId`; the
 * line is found through `ctx.db` first, on this job, so nothing outside the
 * company — or outside the job the guard checked — is ever reached.
 */

export const scopeItemSchema = z.object({
  title: z.string().trim().min(1, "validation.required").max(500),
  body: z
    .string()
    .max(100_000)
    .transform((html) => sanitizeRichText(html, "basic"))
    .transform((html) => (isRichTextEmpty(html) ? null : html)),
});

export type ScopeItemInput = z.infer<typeof scopeItemSchema>;

/** A line as the history keeps it. */
export type ScopeSnapshot = { title: string; body: string | null };

/** Whether saving would change anything — a save with nothing new writes no history. */
export function scopeChanged(before: ScopeSnapshot, after: ScopeSnapshot): boolean {
  return before.title !== after.title || (before.body ?? null) !== (after.body ?? null);
}

function activity(ctx: CompanyContext, jobId: string, action: "added" | "edited" | "deleted", title: string, itemId?: string) {
  return {
    companyId: ctx.company.id,
    jobId,
    actorId: ctx.user.id,
    type: JobActivityType.SCOPE_CHANGED,
    params: { action, title, ...(itemId ? { itemId } : {}) },
  };
}

export async function addScopeItem(ctx: CompanyContext, jobId: string, input: ScopeItemInput): Promise<string> {
  const last = await ctx.db.jobScopeItem.findFirst({
    where: { jobId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const item = await tx.jobScopeItem.create({
      data: {
        companyId: ctx.company.id,
        jobId,
        position: (last?.position ?? -1) + 1,
        title: input.title,
        body: input.body,
        editedById: ctx.user.id,
        editedAt: now,
      },
      select: { id: true },
    });
    await tx.jobScopeChange.create({
      data: {
        companyId: ctx.company.id,
        jobId,
        scopeItemId: item.id,
        kind: JobScopeChangeKind.ADDED,
        after: { title: input.title, body: input.body },
        authorId: ctx.user.id,
      },
    });
    await tx.jobActivity.create({ data: activity(ctx, jobId, "added", input.title, item.id) });
    return item.id;
  });
}

/** Returns false when the line isn't on this job, or nothing changed. */
export async function updateScopeItem(
  ctx: CompanyContext,
  jobId: string,
  itemId: string,
  input: ScopeItemInput,
): Promise<boolean> {
  const item = await ctx.db.jobScopeItem.findFirst({ where: { id: itemId, jobId }, select: { title: true, body: true } });
  if (!item || !scopeChanged(item, input)) return false;

  await prisma.$transaction([
    prisma.jobScopeItem.update({
      where: { id: itemId, companyId: ctx.company.id },
      data: { title: input.title, body: input.body, editedById: ctx.user.id, editedAt: new Date() },
    }),
    prisma.jobScopeChange.create({
      data: {
        companyId: ctx.company.id,
        jobId,
        scopeItemId: itemId,
        kind: JobScopeChangeKind.EDITED,
        before: { title: item.title, body: item.body },
        after: { title: input.title, body: input.body },
        authorId: ctx.user.id,
      },
    }),
    prisma.jobActivity.create({ data: activity(ctx, jobId, "edited", input.title, itemId) }),
  ]);
  return true;
}

/** Returns false when the line isn't on this job. Its history stays, with what it said. */
export async function deleteScopeItem(ctx: CompanyContext, jobId: string, itemId: string): Promise<boolean> {
  const item = await ctx.db.jobScopeItem.findFirst({ where: { id: itemId, jobId }, select: { title: true, body: true } });
  if (!item) return false;

  await prisma.$transaction([
    prisma.jobScopeChange.create({
      data: {
        companyId: ctx.company.id,
        jobId,
        scopeItemId: itemId,
        kind: JobScopeChangeKind.DELETED,
        before: { title: item.title, body: item.body },
        authorId: ctx.user.id,
      },
    }),
    prisma.jobActivity.create({ data: activity(ctx, jobId, "deleted", item.title) }),
    prisma.jobScopeItem.delete({ where: { id: itemId, companyId: ctx.company.id } }),
  ]);
  return true;
}

/** Every hand on the scope, newest first. */
export async function scopeHistory(ctx: CompanyContext, jobId: string) {
  return ctx.db.jobScopeChange.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      before: true,
      after: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
    },
  });
}
