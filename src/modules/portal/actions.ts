"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { translateFieldErrors } from "@/lib/i18n-errors";
import {
  MessageAuthor,
  QuoteEventType,
  QuoteStatus,
  SignatureType,
} from "@/generated/prisma/enums";
import { sendAcceptedEmail } from "@/modules/email-templates/accepted-email";
import { notifyClientMessage, notifyQuoteDecided } from "@/modules/notifications/service";
import { acceptQuoteSchema, buildStatement, clientMessageSchema, declineQuoteSchema } from "./schemas";
import { canClientRespond, resolveShare } from "./service";

export type PortalActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  done?: boolean;
};

async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

/**
 * The customer accepts their quote.
 *
 * Everything backing the acceptance — who they said they were, the text they
 * read, their signature, the IP and the time — is stored together. The text is
 * frozen here: if the company edits it tomorrow, this must not change.
 */
export async function acceptQuoteAction(
  token: string,
  _prev: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const t = await getTranslations();
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) return { error: t("portal.errors.notAvailable") };
  if (!canClientRespond(share.quote.status)) return { error: t("portal.errors.notAvailable") };

  const company = share.company;

  // The checkbox only exists when the company requires it.
  if (company.acceptanceMode === "STATEMENT_WITH_CHECKBOX" && formData.get("agree") !== "on") {
    return { fieldErrors: { agree: [t("portal.errors.statementRequired")] } };
  }

  const parsed = acceptQuoteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    signatureType: formData.get("signatureType") || SignatureType.NONE,
    signatureData: formData.get("signatureData"),
    additionalComments: formData.get("additionalComments"),
    orderReference: formData.get("orderReference"),
  });

  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  if (company.requireSignature && !parsed.data.signatureData) {
    return { fieldErrors: { signatureData: [t("portal.errors.signatureRequired")] } };
  }

  const meta = await requestMeta();
  const statementText = buildStatement(
    company.acceptanceStatement,
    parsed.data.name,
    t("portal.defaultStatement"),
  );

  await prisma.$transaction([
    prisma.quoteAcceptance.create({
      data: {
        companyId: company.id,
        quoteId: share.quoteId,
        acceptedByName: parsed.data.name,
        acceptedByEmail: parsed.data.email ?? null,
        statementText,
        signatureType: parsed.data.signatureType,
        signatureData: parsed.data.signatureData ?? null,
        additionalComments: parsed.data.additionalComments ?? null,
        orderReference: parsed.data.orderReference ?? null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
    prisma.quote.update({
      where: { id: share.quoteId },
      data: { status: QuoteStatus.ACCEPTED, decidedAt: new Date() },
    }),
    prisma.quoteEvent.create({
      data: {
        companyId: company.id,
        quoteId: share.quoteId,
        type: QuoteEventType.ACCEPTED,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  // The notice must not keep the customer waiting in front of the screen.
  after(() => notifyQuoteDecided(share.quoteId, "accepted"));
  // The customer hears back too. Until now accepting produced silence on their
  // side, which for a commercial commitment reads like a form that didn't submit.
  after(() => sendAcceptedEmail(share.quoteId));

  revalidatePath(`/q/${token}`);
  return { done: true };
}

export async function declineQuoteAction(
  token: string,
  _prev: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const t = await getTranslations();
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) return { error: t("portal.errors.notAvailable") };
  if (!canClientRespond(share.quote.status)) return { error: t("portal.errors.notAvailable") };

  const parsed = declineQuoteSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const meta = await requestMeta();

  await prisma.$transaction([
    prisma.quote.update({
      where: { id: share.quoteId },
      data: { status: QuoteStatus.REJECTED, decidedAt: new Date() },
    }),
    prisma.quoteEvent.create({
      data: {
        companyId: share.company.id,
        quoteId: share.quoteId,
        type: QuoteEventType.DECLINED,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  // The reason for declining goes into the thread: it's what the team will want to read.
  if (parsed.data.reason) {
    await prisma.quoteMessage.create({
      data: {
        companyId: share.company.id,
        quoteId: share.quoteId,
        author: MessageAuthor.CLIENT,
        body: parsed.data.reason,
      },
    });
  }

  after(() => notifyQuoteDecided(share.quoteId, "declined"));

  revalidatePath(`/q/${token}`);
  return { done: true };
}

export async function sendClientMessageAction(
  token: string,
  _prev: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const t = await getTranslations();
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) return { error: t("portal.errors.notAvailable") };

  const parsed = clientMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await prisma.$transaction([
    prisma.quoteMessage.create({
      data: {
        companyId: share.company.id,
        quoteId: share.quoteId,
        author: MessageAuthor.CLIENT,
        body: parsed.data.body,
      },
    }),
    prisma.quoteEvent.create({
      data: {
        companyId: share.company.id,
        quoteId: share.quoteId,
        type: QuoteEventType.MESSAGE_SENT,
      },
    }),
  ]);

  after(() => notifyClientMessage(share.quoteId, parsed.data.body));

  revalidatePath(`/q/${token}`);
  return { done: true };
}
