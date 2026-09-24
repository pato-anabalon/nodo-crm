"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { sanitizeRichText } from "@/lib/rich-text";
import { checkbox } from "@/modules/settings/schemas";
import { emailSettingsSchema, emailTemplateSchema, reviewLinkSchema } from "./schemas";
import { saveTemplate } from "./service";

export type EmailTemplateState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

async function saved(): Promise<EmailTemplateState> {
  const t = await getTranslations("settings");
  return { message: t("saved") };
}

/**
 * Who writes to the company's customers is not a personal preference, so this
 * needs `settings.update` rather than being open to anyone who can send a quote.
 */
export async function saveEmailTemplateAction(
  _prev: EmailTemplateState,
  formData: FormData,
): Promise<EmailTemplateState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = emailTemplateSchema.safeParse({
    kind: formData.get("kind"),
    subject: formData.get("subject"),
    bodyHtml: formData.get("bodyHtml"),
    enabled: checkbox(formData, "enabled"),
  });

  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await saveTemplate(ctx, {
    ...parsed.data,
    // Cleaned on the way in as well as on the way out. The request can be
    // hand-crafted, and this text ends up in somebody else's inbox.
    bodyHtml: parsed.data.bodyHtml ? sanitizeRichText(parsed.data.bodyHtml) : null,
  });

  revalidatePath("/settings/emails");
  return saved();
}

export async function saveEmailSettingsAction(
  _prev: EmailTemplateState,
  formData: FormData,
): Promise<EmailTemplateState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = emailSettingsSchema.safeParse({
    quoteFooter: formData.get("quoteFooter"),
    slogan: formData.get("slogan"),
    senderNameStyle: formData.get("senderNameStyle"),
    sendQuoteCopy: checkbox(formData, "sendQuoteCopy"),
    firstFollowUpDays: formData.get("firstFollowUpDays"),
    secondFollowUpDays: formData.get("secondFollowUpDays"),
    reviewRequestDays: formData.get("reviewRequestDays"),
  });

  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await ctx.db.company.update({
    where: { id: ctx.company.id },
    data: {
      ...parsed.data,
      quoteFooter: parsed.data.quoteFooter ? sanitizeRichText(parsed.data.quoteFooter) : null,
    },
  });

  revalidatePath("/settings/emails");
  revalidatePath("/settings", "layout");
  return saved();
}

/**
 * Adds one place to be reviewed.
 *
 * One at a time so each can be checked on the way in. A box of URLs separated by
 * commas hides a typo in the third one until somebody notices nobody reviews
 * them, which is months.
 */
export async function addReviewLinkAction(
  _prev: EmailTemplateState,
  formData: FormData,
): Promise<EmailTemplateState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = reviewLinkSchema.safeParse({
    source: formData.get("source"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const count = await ctx.db.reviewLink.count();
  await ctx.db.reviewLink.upsert({
    where: { companyId_source: { companyId: ctx.company.id, source: parsed.data.source } },
    create: { companyId: ctx.company.id, ...parsed.data, position: count },
    // One link per platform: a second Google link is a corrected one, not
    // another place to send people.
    update: { url: parsed.data.url },
  });

  revalidatePath("/settings/emails");
  return saved();
}

export async function removeReviewLinkAction(id: string): Promise<EmailTemplateState> {
  const ctx = await requirePermission("settings.update");
  await ctx.db.reviewLink.deleteMany({ where: { id } });

  revalidatePath("/settings/emails");
  return saved();
}
