"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { QuoteStatus } from "@/generated/prisma/enums";
import { sendAcceptedEmail } from "@/modules/email-templates/accepted-email";
import { quoteFormDataToInput, quoteFormSchema } from "./schemas";
import { changeQuoteStatus, createQuote, deleteQuote, getQuote, updateQuote } from "./service";
import { revokeShare } from "@/modules/portal/service";
import { logLeadConverted } from "@/modules/leads/service";
import { MessageAuthor } from "@/generated/prisma/enums";
import { clientMessageSchema } from "@/modules/portal/schemas";
import { formatQuoteNumber } from "@/lib/format";
import { put, del } from "@vercel/blob";
import {
  MAX_ATTACHMENTS_PER_QUOTE,
  MAX_ATTACHMENT_BYTES,
  attachmentPathname,
  checkAttachment,
} from "./attachments";
import { sendQuoteEmail } from "./email";

export type QuoteActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set by actions whose form has to clear itself once it went through. */
  done?: boolean;
  /** Set by `uploadQuoteAttachmentAction` on success — the manager appends it
   * to its own list directly rather than waiting on a page revalidation to
   * reach a client component that's already mounted with its own state. */
  attachment?: { id: string; name: string; url: string; size: number; contentType: string };
};

export async function createQuoteAction(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.create");

  const parsed = quoteFormSchema.safeParse(quoteFormDataToInput(formData));
  if (!parsed.success) {
    const t = await getTranslations();
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const quote = await createQuote(ctx, parsed.data);

  // It's recorded on the lead that a quote went out from it.
  if (quote.leadId) {
    await logLeadConverted(ctx, quote.leadId, formatQuoteNumber(ctx.company.quotePrefix, quote.number));
    revalidatePath(`/leads/${quote.leadId}`);
  }

  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

export async function updateQuoteAction(
  id: string,
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");

  const parsed = quoteFormSchema.safeParse(quoteFormDataToInput(formData));
  if (!parsed.success) {
    const t = await getTranslations();
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const t = await getTranslations("quotes");
  const result = await updateQuote(ctx, id, parsed.data);
  if (!result.ok) {
    return { error: result.reason === "locked" ? t("locked") : t("notFoundOrNoAccess") };
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { message: t("changesSaved") };
}

/** Marks the quote as sent and, if the contact has an email, sends it. */
export async function sendQuoteAction(id: string): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.send");

  const t = await getTranslations("quotes");
  const result = await changeQuoteStatus(ctx, id, QuoteStatus.SENT);
  if (!result.ok) {
    const message =
      result.reason === "invalid-transition"
        ? t("onlyDraftCanBeSent")
        : result.reason === "no-lead"
          ? t("needsLeadToSend")
          : t("notFound");
    return { error: message };
  }

  const delivery = await sendQuoteEmail(ctx, id);

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);

  return delivery.sent
    ? { message: t("sentTo", { email: delivery.to }) }
    : { message: t("markedAsSent", { reason: delivery.reason }) };
}

/**
 * Sends the quote to the customer again.
 *
 * Each send issues a new link and the previous one stops working, because only
 * the hash of the token is kept. The customer uses the newest email, which is
 * the one they were going to look at anyway.
 */
export async function resendQuoteAction(id: string): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.send");
  const t = await getTranslations("quotes");

  const quote = await getQuote(ctx, id);
  if (!quote) return { error: t("notFound") };
  if (quote.status !== QuoteStatus.SENT) return { error: t("share.onlySentCanBeResent") };

  const delivery = await sendQuoteEmail(ctx, id);
  if (!delivery.sent) return { error: delivery.reason };

  revalidatePath(`/quotes/${id}`);
  return { message: t("share.resentTo", { email: delivery.to }) };
}

/**
 * Closes the customer's link without touching the quote.
 *
 * The status is left alone on purpose: a quote whose link was revoked is still
 * a quote that was sent, and rewriting its history to say otherwise would lose
 * what actually happened.
 */
export async function revokeShareAction(id: string): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.send");
  const t = await getTranslations("quotes");

  const closed = await revokeShare(ctx, id);
  if (!closed) return { error: t("share.nothingToRevoke") };

  revalidatePath(`/quotes/${id}`);
  return { message: t("share.revoked") };
}

export async function decideQuoteAction(
  id: string,
  decision: "ACCEPTED" | "REJECTED",
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.decide");

  const t = await getTranslations("quotes");
  const result = await changeQuoteStatus(ctx, id, QuoteStatus[decision]);
  if (!result.ok) {
    return {
      error: result.reason === "invalid-transition" ? t("onlySentCanBeDecided") : t("notFound"),
    };
  }

  // Somebody ringing to say yes is the same news as them pressing accept, so
  // the customer gets the same confirmation either way.
  if (decision === "ACCEPTED") after(() => sendAcceptedEmail(id));

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  return { message: decision === "ACCEPTED" ? t("accepted") : t("rejected") };
}

export async function deleteQuoteAction(id: string): Promise<void> {
  const ctx = await requirePermission("quotes.delete");
  await deleteQuote(ctx, id);

  revalidatePath("/quotes");
  redirect("/quotes");
}


/** The company's reply in the quote's thread. */
export async function sendStaffMessageAction(
  quoteId: string,
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");
  const t = await getTranslations();

  const parsed = clientMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  // `ctx.db` guarantees the quote belongs to this company.
  const quote = await ctx.db.quote.findFirst({ where: { id: quoteId }, select: { id: true } });
  if (!quote) return { error: t("quotes.notFound") };

  await ctx.db.quoteMessage.create({
    data: {
      companyId: ctx.company.id,
      quoteId,
      author: MessageAuthor.STAFF,
      authorUserId: ctx.user.id,
      body: parsed.data.body,
    },
  });

  revalidatePath(`/quotes/${quoteId}`);
  return { done: true };
}

/**
 * Uploads a file to a quote, or to one of its sections when `sectionId` is
 * given. Both share this one action — same checks, same storage path, same
 * table — rather than a copy of it for the section case.
 */
export async function uploadQuoteAttachmentAction(
  quoteId: string,
  sectionId: string | null,
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");
  const t = await getTranslations("quotes.attachments");

  const quote = await ctx.db.quote.findFirst({ where: { id: quoteId }, select: { id: true } });
  if (!quote) return { error: t("notFound") };

  // The `quoteId` in the where is what stops attaching to a section of
  // another quote — `ctx.db` alone only guards the tenant, not the quote.
  if (sectionId) {
    const section = await ctx.db.quoteSection.findFirst({
      where: { id: sectionId, quoteId },
      select: { id: true },
    });
    if (!section) return { error: t("notFound") };
  }

  // Each section counts against its own cap, separate from the quote's own
  // list — one section with several photos shouldn't crowd out another's.
  const existingCount = await ctx.db.quoteAttachment.count({
    where: sectionId ? { sectionId } : { quoteId, sectionId: null },
  });

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: t("errors.empty") };

  const check = checkAttachment(file, existingCount);
  if (!check.ok) {
    return {
      error:
        check.reason === "type"
          ? t("errors.type")
          : check.reason === "size"
            ? t("errors.size", { max: MAX_ATTACHMENT_BYTES / (1024 * 1024) })
            : check.reason === "too-many"
              ? t("errors.tooMany", { max: MAX_ATTACHMENTS_PER_QUOTE })
              : t("errors.empty"),
    };
  }

  const blob = await put(attachmentPathname(ctx.company.id, quoteId, file.name), file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  const attachment = await ctx.db.quoteAttachment.create({
    data: {
      quoteId,
      sectionId,
      name: file.name,
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type,
      size: file.size,
      position: existingCount,
      uploadedById: ctx.user.id,
    },
  });

  revalidatePath(`/quotes/${quoteId}`);
  return {
    message: t("uploaded"),
    attachment: {
      id: attachment.id,
      name: attachment.name,
      url: attachment.url,
      size: attachment.size,
      contentType: attachment.contentType,
    },
  };
}

export async function deleteQuoteAttachmentAction(
  quoteId: string,
  attachmentId: string,
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");
  const t = await getTranslations("quotes.attachments");

  // The `quote` in the where is what stops an attachment of another company being deleted.
  const attachment = await ctx.db.quoteAttachment.findFirst({
    where: { id: attachmentId, quoteId },
    select: { url: true },
  });
  if (!attachment) return { error: t("notFound") };

  await ctx.db.quoteAttachment.deleteMany({ where: { id: attachmentId, quoteId } });
  await del(attachment.url).catch(() => undefined);

  revalidatePath(`/quotes/${quoteId}`);
  return { message: t("deleted") };
}
