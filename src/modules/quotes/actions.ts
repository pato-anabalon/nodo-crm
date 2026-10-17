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
import { del, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import {
  MAX_ATTACHMENTS_PER_QUOTE,
  MAX_ATTACHMENT_BYTES,
  attachmentPathname,
  checkAttachment,
  isAttachmentPathOf,
  type AttachmentCheck,
} from "./attachments";
import { sendQuoteEmail } from "./email";

export type QuoteActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set by actions whose form has to clear itself once it went through. */
  done?: boolean;
  /** Set by `registerQuoteAttachmentAction` on success — the manager appends it
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
    const reasons = { locked: "locked", "lead-locked": "leadLocked", "not-found": "notFoundOrNoAccess" } as const;
    return { error: t(reasons[result.reason]) };
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
    ? { message: withFailures(t("sentTo", { email: delivery.to }), delivery.failed, t) }
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
  return {
    message: withFailures(t("share.resentTo", { email: delivery.to }), delivery.failed, t),
  };
}

/** A send that reached some recipients and not others says both. */
function withFailures(
  message: string,
  failed: string[],
  t: Awaited<ReturnType<typeof getTranslations<"quotes">>>,
): string {
  return failed.length === 0
    ? message
    : `${message} ${t("email.notDelivered", { emails: failed.join(", ") })}`;
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
/** What the browser says about the file it is about to upload — only ever
 * a claim, re-read from the store itself once the file is there. */
export type AttachmentFileInfo = { name: string; size: number; type: string };

export type AttachmentUploadTicket = {
  error?: string;
  pathname?: string;
  /** Lets the browser write exactly one file, at `pathname`, of that type and
   * up to the size limit — Blob enforces all three, not this code. */
  token?: string;
};

/** How long the browser has to start sending once it was allowed to. A large
 * file goes up in parts, each one presenting the same token. */
const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Whether the person may add a file to this quote (or to this section of it),
 * and how many are already there. Asked twice per upload — before the token
 * is issued and again before the row is written — because those are two
 * separate requests and the second can't take the first's word for it.
 */
async function attachmentTarget(
  ctx: Awaited<ReturnType<typeof requirePermission>>,
  quoteId: string,
  sectionId: string | null,
): Promise<{ existingCount: number } | null> {
  const quote = await ctx.db.quote.findFirst({ where: { id: quoteId }, select: { id: true } });
  if (!quote) return null;

  // The `quoteId` in the where is what stops attaching to a section of
  // another quote — `ctx.db` alone only guards the tenant, not the quote.
  if (sectionId) {
    const section = await ctx.db.quoteSection.findFirst({
      where: { id: sectionId, quoteId },
      select: { id: true },
    });
    if (!section) return null;
  }

  // Each section counts against its own cap, separate from the quote's own
  // list — one section with several photos shouldn't crowd out another's.
  const existingCount = await ctx.db.quoteAttachment.count({
    where: sectionId ? { sectionId } : { quoteId, sectionId: null },
  });
  return { existingCount };
}

async function attachmentCheckError(check: AttachmentCheck): Promise<string | undefined> {
  if (check.ok) return undefined;
  const t = await getTranslations("quotes.attachments");
  return check.reason === "type"
    ? t("errors.type")
    : check.reason === "size"
      ? t("errors.size", { max: MAX_ATTACHMENT_BYTES / (1024 * 1024) })
      : check.reason === "too-many"
        ? t("errors.tooMany", { max: MAX_ATTACHMENTS_PER_QUOTE })
        : t("errors.empty");
}

/**
 * Step one of an upload: everything the old single action checked, then a
 * token instead of the file.
 *
 * The file itself goes from the browser straight to Blob. Through a Server
 * Action it travelled inside a Vercel Function's request body, which the
 * platform caps at 4.5 MB before any of this code runs — so in production
 * the 20 MB limit was really 4.5, and anything above it came back as a bare
 * `FUNCTION_PAYLOAD_TOO_LARGE`. `bodySizeLimit` in `next.config.ts` only
 * moves Next's own cap, never the platform's.
 */
export async function prepareQuoteAttachmentUploadAction(
  quoteId: string,
  sectionId: string | null,
  file: AttachmentFileInfo,
): Promise<AttachmentUploadTicket> {
  const ctx = await requirePermission("quotes.update");
  const t = await getTranslations("quotes.attachments");

  const target = await attachmentTarget(ctx, quoteId, sectionId);
  if (!target) return { error: t("notFound") };

  const error = await attachmentCheckError(checkAttachment(file, target.existingCount));
  if (error) return { error };

  // The path is the server's, never the browser's: the token is bound to it,
  // so this is what keeps the file inside this company's and this quote's
  // folder whatever the request claims.
  const pathname = attachmentPathname(ctx.company.id, quoteId, file.name);
  const token = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: [file.type],
    maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
    addRandomSuffix: true,
    allowOverwrite: false,
    validUntil: Date.now() + UPLOAD_TOKEN_TTL_MS,
  });

  return { pathname, token };
}

/**
 * Step two: the file is in the store, and the browser says where.
 *
 * Nothing in that claim is trusted. The path has to sit in this quote's own
 * folder, the store is asked whether the file is really there, and the size
 * and type written to the row are the store's answer, not the browser's.
 */
export async function registerQuoteAttachmentAction(
  quoteId: string,
  sectionId: string | null,
  upload: { pathname: string; name: string },
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");
  const t = await getTranslations("quotes.attachments");

  const target = await attachmentTarget(ctx, quoteId, sectionId);
  if (!target) return { error: t("notFound") };

  if (!isAttachmentPathOf(ctx.company.id, quoteId, upload.pathname)) {
    return { error: t("notFound") };
  }

  const stored = await head(upload.pathname).catch(() => null);
  if (!stored) return { error: t("notFound") };

  // One file, one row: a second row on the same blob would leave the first
  // pointing at nothing the moment either was deleted.
  const taken = await ctx.db.quoteAttachment.count({ where: { pathname: stored.pathname } });
  if (taken > 0) return { error: t("notFound") };

  const name = upload.name.trim().slice(0, 255) || stored.pathname.split("/").pop()!;
  const error = await attachmentCheckError(
    checkAttachment({ name, size: stored.size, type: stored.contentType }, target.existingCount),
  );
  if (error) {
    // Uploaded but refused — most likely the cap filled up between the two
    // steps. Nothing will ever point at the file, so it goes.
    await del(stored.url).catch(() => undefined);
    return { error };
  }

  const attachment = await ctx.db.quoteAttachment.create({
    data: {
      quoteId,
      sectionId,
      name,
      url: stored.url,
      pathname: stored.pathname,
      contentType: stored.contentType,
      size: stored.size,
      position: target.existingCount,
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
