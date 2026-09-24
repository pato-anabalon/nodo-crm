"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { duplicateQuote } from "@/modules/quotes/service";
import { templateNameSchema } from "./schemas";
import {
  createTemplateFromQuote,
  deleteQuoteTemplate,
  renameQuoteTemplate,
  setQuoteTemplateActive,
} from "./service";

export type TemplateState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function saveQuoteAsTemplateAction(
  quoteId: string,
  _prev: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const ctx = await requirePermission("quotes.create");
  const t = await getTranslations();

  const parsed = templateNameSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const created = await createTemplateFromQuote(ctx, quoteId, parsed.data);
  if (!created) return { error: t("quotes.notFound") };

  revalidatePath("/settings/templates");
  return { message: t("quoteTemplates.saved", { name: created.name }) };
}

export async function renameQuoteTemplateAction(
  id: string,
  _prev: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = templateNameSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const done = await renameQuoteTemplate(ctx, id, parsed.data);
  if (!done) return { error: t("quoteTemplates.notFound") };

  revalidatePath("/settings/templates");
  return { message: t("common.saveChanges") };
}

export async function setQuoteTemplateActiveAction(
  id: string,
  active: boolean,
): Promise<TemplateState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("quoteTemplates");

  const done = await setQuoteTemplateActive(ctx, id, active);
  if (!done) return { error: t("notFound") };

  revalidatePath("/settings/templates");
  return { message: active ? t("restored") : t("retired") };
}

export async function deleteQuoteTemplateAction(id: string): Promise<TemplateState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("quoteTemplates");

  const done = await deleteQuoteTemplate(ctx, id);
  revalidatePath("/settings/templates");
  return done ? { message: t("deleted") } : { error: t("notFound") };
}

/**
 * Starts a new draft from an existing quote.
 *
 * The lead comes from the source quote when it had one, so "quote this again for
 * the same customer" needs no further typing; everything else is editable before
 * it goes anywhere, because the new draft is just a draft.
 */
export async function duplicateQuoteAction(quoteId: string): Promise<void> {
  const ctx = await requirePermission("quotes.create");

  const source = await ctx.db.quote.findFirst({
    where: { id: quoteId },
    select: { leadId: true },
  });

  const created = await duplicateQuote(ctx, quoteId, source?.leadId ?? null);
  if (!created) return;

  revalidatePath("/quotes");
  redirect(`/quotes/${created.id}`);
}
