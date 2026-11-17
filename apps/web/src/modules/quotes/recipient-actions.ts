"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { searchContacts } from "@/modules/contacts/service";
import type { ContactSearchItem } from "@/modules/contacts/actions";
import {
  addRecipient,
  makePrimaryRecipient,
  removeRecipient,
  type RecipientResult,
} from "./recipients-service";
import type { QuoteActionState } from "./actions";

const newRecipientSchema = z.object({
  firstName: z.string().trim().min(1, "validation.required").max(80),
  lastName: z
    .string()
    .trim()
    .max(80)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "validation.invalidEmail"),
});

/** Adds an existing contact to the quote's recipients. */
export async function addContactRecipientAction(
  quoteId: string,
  contactId: string,
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");
  return answer(quoteId, await addRecipient(ctx, quoteId, { contactId }), "added");
}

/**
 * Adds somebody by address, creating the contact when there isn't one.
 * Called with the small form the "add contact" step shows, so it answers with
 * field errors the way any other form does.
 */
export async function addNewRecipientAction(
  quoteId: string,
  input: { firstName: string; lastName: string; email: string },
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");

  const parsed = newRecipientSchema.safeParse(input);
  if (!parsed.success) {
    const t = await getTranslations();
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const result = await addRecipient(ctx, quoteId, {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName ?? null,
    email: parsed.data.email,
  });
  return answer(quoteId, result, "added");
}

export async function removeRecipientAction(
  quoteId: string,
  recipientId: string,
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");
  return answer(quoteId, await removeRecipient(ctx, quoteId, recipientId), "removed");
}

export async function makePrimaryRecipientAction(
  quoteId: string,
  recipientId: string,
): Promise<QuoteActionState> {
  const ctx = await requirePermission("quotes.update");
  return answer(quoteId, await makePrimaryRecipient(ctx, quoteId, recipientId), "madePrimary");
}

/**
 * The contact search behind "add recipient". Its own action rather than the
 * lead form's, because that one asks for `leads.read` and adding somebody to a
 * quote is a quote permission.
 */
export async function searchRecipientContactsAction(query: string): Promise<ContactSearchItem[]> {
  const ctx = await requirePermission("quotes.update");
  const items = await searchContacts(ctx, query);
  return items.map((contact) => ({
    id: contact.id,
    label: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    description: contact.email ?? contact.clientCompany?.name ?? null,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    clientCompanyId: contact.clientCompanyId,
    clientCompanyName: contact.clientCompany?.name ?? null,
  }));
}

const ERROR_KEYS = {
  "not-found": "notFound",
  locked: "locked",
  duplicate: "duplicate",
  "no-email": "noEmail",
  primary: "primary",
} as const;

async function answer(
  quoteId: string,
  result: RecipientResult,
  success: "added" | "removed" | "madePrimary",
): Promise<QuoteActionState> {
  const t = await getTranslations("quotes.recipients");
  if (!result.ok) return { error: t(`errors.${ERROR_KEYS[result.reason]}`) };

  revalidatePath(`/quotes/${quoteId}`);
  return { message: t(success), done: true };
}
