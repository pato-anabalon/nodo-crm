import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import type { CompanyContext } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { QuoteEventType, QuoteStatus } from "@/generated/prisma/enums";
import { generateShareToken, hashShareToken, isViewingNow, shareStatus, type ShareStatus } from "./share";

/**
 * The end customer's context: the system's third actor.
 *
 * They have no session and belong to no company. The link authorises them to
 * view and respond to **one** quote and nothing else, so this resolver is the
 * single entry point for everything they do from the portal.
 */
export type PortalContext = Awaited<ReturnType<typeof resolveShare>>;

/**
 * What the quote document needs about the company that issues it.
 *
 * Shared with the company's own preview so that both read from one shape: a
 * field added here reaches the customer's page and the preview at once, and
 * neither can quietly drift from the other.
 */
export const companyDocumentSelect = {
  id: true,
  slug: true,
  name: true,
  legalName: true,
  // What the customer needs to call, or to check who is quoting.
  taxId: true,
  email: true,
  phone: true,
  website: true,
  address: true,
  logoUrl: true,
  watermarkUrl: true,
  primaryColor: true,
  accentColor: true,
  formatLocale: true,
  timezone: true,
  quotePrefix: true,
  acceptanceMode: true,
  acceptanceStatement: true,
  requireSignature: true,
  askAdditionalComments: true,
  askOrderReference: true,
  reviews: {
    where: { featured: true },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: 3,
  },
} satisfies Prisma.CompanySelect;

/** What the quote document needs about the quote itself. */
export const quoteDocumentInclude = {
  items: { orderBy: { position: "asc" } },
  sections: {
    orderBy: { position: "asc" },
    include: { attachments: { orderBy: { position: "asc" } } },
  },
  // Section-scoped attachments travel with their section above, not here, or
  // they'd show twice on the customer's own document.
  attachments: { where: { sectionId: null }, orderBy: { position: "asc" } },
  termsDocument: { select: { name: true, url: true } },
  // The quote is signed by a person, not by the legal entity.
  createdBy: { select: { name: true, email: true, jobTitle: true, phone: true } },
  acceptance: true,
  messages: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.QuoteInclude;

export const resolveShare = cache(async (token: string) => {
  if (!token || token.length < 20) {
    return { status: "not-found" as ShareStatus, share: null };
  }

  /*
   * The token is looked up, the share is what answers.
   *
   * A quote's link can have been handed out more than once — the first email and
   * every follow-up carry their own token — and all of them open the same
   * quote. Whether any of them still works is a property of the share: revoked
   * or expired closes every door at once, which is what revoking was always
   * meant to mean.
   */
  const found = await prisma.quoteShareToken.findUnique({
    where: { hashedToken: hashShareToken(token) },
    select: {
      revokedAt: true,
      share: {
        include: {
          company: { select: companyDocumentSelect },
          quote: { include: quoteDocumentInclude },
        },
      },
    },
  });

  const share = found?.share ?? null;

  // A token the company closed stays closed, even after a later send reopens
  // the link for everybody else.
  if (found?.revokedAt) return { status: "revoked" as ShareStatus, share };

  return { status: shareStatus(share), share };
});

/** Records an open and refreshes presence. */
export async function recordOpen(input: {
  shareId: string;
  companyId: string;
  quoteId: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const now = new Date();

  await prisma.$transaction([
    prisma.quoteEvent.create({
      data: {
        companyId: input.companyId,
        quoteId: input.quoteId,
        type: QuoteEventType.OPENED,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    }),
    prisma.quoteShare.update({
      where: { id: input.shareId },
      data: { openCount: { increment: 1 }, lastSeenAt: now, viewing: true },
    }),
  ]);
}

/**
 * Heartbeat from the customer's page.
 *
 * Updates one row instead of inserting one per beat: the panel only needs to
 * know whether someone is looking right now, not a record of every second.
 */
export async function touchPresence(shareId: string) {
  await prisma.quoteShare.update({
    where: { id: shareId },
    data: { lastSeenAt: new Date(), viewing: true },
  });
}

/**
 * The customer's tab saying it's leaving — sent on `pagehide`, not waited out.
 *
 * Without this, a closed tab reads as watched for up to the presence window
 * (see `isViewingNow`), because a heartbeat going quiet looks identical to one
 * that stopped on purpose until the window runs out. `lastSeenAt` still moves
 * to now: leaving *is* the last instant they were actually looking, so "last
 * seen" stays accurate rather than freezing on the second-to-last heartbeat.
 */
export async function markLeft(shareId: string) {
  await prisma.quoteShare.update({
    where: { id: shareId },
    data: { lastSeenAt: new Date(), viewing: false },
  });
}

export async function recordClientEvent(input: {
  companyId: string;
  quoteId: string;
  type: QuoteEventType;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  return prisma.quoteEvent.create({ data: { ...input } });
}

/** Only a sent quote can be answered by the customer. */
export function canClientRespond(status: QuoteStatus): boolean {
  return status === QuoteStatus.SENT;
}

/**
 * Issues the customer's link for a quote, replacing any previous one.
 *
 * Only the hash is stored, so an existing token cannot be read back: every send
 * necessarily carries a new link, and the one sent before stops working. That is
 * the price of not keeping a token that would let a database dump accept a quote
 * in the customer's name — and accepting is a commercial commitment, not a read.
 *
 * Revoking is undone here on purpose: sending again is the deliberate act of
 * putting the quote back within the customer's reach.
 */
export async function issueShare(input: {
  companyId: string;
  quoteId: string;
  expiresAt?: Date | null;
}): Promise<{ token: string }> {
  const { token, hashedToken } = generateShareToken();

  /*
   * Adds a link; it does not replace the one before it.
   *
   * Issuing used to overwrite the single hash, so sending a follow-up broke the
   * email that first sent the quote — asking somebody to look at something and
   * taking away the way they had to look at it. The new token exists because an
   * issued one can never be read back, not because the old one should stop
   * working.
   *
   * Reopening on issue is kept: sending again after revoking is somebody
   * deliberately letting the customer back in.
   */
  const share = await prisma.quoteShare.upsert({
    where: { quoteId: input.quoteId },
    create: {
      companyId: input.companyId,
      quoteId: input.quoteId,
      expiresAt: input.expiresAt ?? null,
    },
    update: { revokedAt: null, expiresAt: input.expiresAt ?? null },
    select: { id: true },
  });

  await prisma.quoteShareToken.create({ data: { shareId: share.id, hashedToken } });

  return { token };
}

/**
 * Closes the customer's link.
 *
 * Goes through `ctx.db` because this one is asked for by the company's team, not
 * by the link holder. Returns whether there was anything to close: revoking
 * twice is not an error worth shouting about.
 */
export async function revokeShare(ctx: CompanyContext, quoteId: string): Promise<boolean> {
  const now = new Date();

  const { count } = await ctx.db.quoteShare.updateMany({
    where: { quoteId, revokedAt: null },
    data: { revokedAt: now },
  });

  // Every link handed out so far, not just the most recent: a quote's link has
  // been sent as many times as there were emails, and closing it has to mean
  // all of them.
  const share = await ctx.db.quoteShare.findFirst({ where: { quoteId }, select: { id: true } });
  if (share) {
    await ctx.db.quoteShareToken.updateMany({
      where: { shareId: share.id, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  return count > 0;
}

/** Link status for the company's panel. */
export async function shareSummary(companyId: string, quoteId: string) {
  const share = await prisma.quoteShare.findFirst({
    where: { quoteId, companyId },
    select: { lastSeenAt: true, viewing: true, openCount: true, revokedAt: true, expiresAt: true },
  });
  if (!share) return null;

  return {
    openCount: share.openCount,
    lastSeenAt: share.lastSeenAt,
    viewingNow: isViewingNow(share),
    revoked: share.revokedAt !== null,
  };
}
