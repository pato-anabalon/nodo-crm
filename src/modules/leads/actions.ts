"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { discardLeadSchema, leadFormDataToInput, leadFormSchema } from "./schemas";
import {
  addLeadNote,
  assignLead,
  createLead,
  deleteLead,
  discardLead,
  listLeads,
  restoreLead,
  updateLead,
} from "./service";

export type LeadActionState = {
  /** What became of the action, for the snackbar. */
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createLeadAction(
  _prev: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const ctx = await requirePermission("leads.create");

  const parsed = leadFormSchema.safeParse(leadFormDataToInput(formData));
  if (!parsed.success) {
    const t = await getTranslations();
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const lead = await createLead(ctx, parsed.data);

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadAction(
  id: string,
  _prev: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const ctx = await requirePermission("leads.update");

  const parsed = leadFormSchema.safeParse(leadFormDataToInput(formData));
  if (!parsed.success) {
    const t = await getTranslations();
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const lead = await updateLead(ctx, id, parsed.data);
  if (!lead) {
    const t = await getTranslations("leads");
    return { error: t("notFoundOrNoAccess") };
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  // Saying nothing is how a save that worked looks exactly like one that didn't.
  return { message: (await getTranslations("common"))("saved") };
}

export async function deleteLeadAction(id: string): Promise<void> {
  const ctx = await requirePermission("leads.delete");
  await deleteLead(ctx, id);

  revalidatePath("/leads");
  redirect("/leads");
}

export async function addLeadNoteAction(
  leadId: string,
  _prev: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const ctx = await requirePermission("leads.update");

  const t = await getTranslations();
  const content = String(formData.get("content") ?? "").trim();

  if (content.length === 0) {
    return { fieldErrors: { content: [t("validation.writeSomething")] } };
  }
  if (content.length > 2000) {
    return { fieldErrors: { content: [t("validation.maxChars", { max: 2000 })] } };
  }

  const note = await addLeadNote(ctx, leadId, content);
  if (!note) return { error: t("leads.notFoundOrNoAccess") };

  revalidatePath(`/leads/${leadId}`);
  return {};
}


export async function assignLeadAction(
  id: string,
  ownerId: string | null,
): Promise<LeadActionState> {
  const ctx = await requirePermission("leads.assign");

  const lead = await assignLead(ctx, id, ownerId || null);
  const t = await getTranslations("leads");
  if (!lead) {
    return { error: t("notFoundOrNoAccess") };
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  // Two outcomes, two sentences: taking the owner off is something somebody
  // meant to do, and hearing "owner updated" for it reads like the wrong one
  // happened.
  return { message: ownerId ? t("ownerSaved") : t("ownerCleared") };
}

export async function discardLeadAction(
  id: string,
  _prev: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const ctx = await requirePermission("leads.update");
  const t = await getTranslations();

  const parsed = discardLeadSchema.safeParse({ reason: formData.get("reason") ?? "" });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const lead = await discardLead(ctx, id, parsed.data.reason ?? null);
  if (!lead) return { error: t("leads.notFoundOrNoAccess") };

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return {};
}

export async function restoreLeadAction(id: string): Promise<LeadActionState> {
  const ctx = await requirePermission("leads.update");

  const lead = await restoreLead(ctx, id);
  if (!lead) {
    const t = await getTranslations("leads");
    return { error: t("notFoundOrNoAccess") };
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return {};
}

/**
 * Backs the "Linked lead" combobox on a quote.
 *
 * `quotes.read` rather than `leads.read`: this runs from the quote form,
 * which already gated the page on that permission, and a rep who can see a
 * quote has always been able to see the full list of leads it could link to
 * — this just stops shipping all of them to search the first twenty.
 */
export async function searchLeadsAction(
  query: string,
): Promise<Array<{ id: string; label: string }>> {
  const ctx = await requirePermission("quotes.read");
  const { items } = await listLeads(ctx, {
    page: 1,
    discarded: false,
    q: query.trim() || undefined,
  });
  return items.map((lead) => ({ id: lead.id, label: lead.title }));
}
