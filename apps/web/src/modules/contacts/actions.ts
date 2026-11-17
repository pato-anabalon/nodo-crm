"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { contactFormSchema } from "./schemas";
import {
  createContact,
  deleteContact,
  linkLeadToContact,
  searchContacts,
  updateContact,
} from "./service";

export type ContactState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function values(formData: FormData) {
  return {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    position: formData.get("position"),
    clientCompanyName: formData.get("clientCompanyName"),
  };
}

export async function createContactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const ctx = await requirePermission("contacts.create");
  const t = await getTranslations();

  const parsed = contactFormSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const contact = await createContact(ctx, parsed.data);

  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function updateContactAction(
  id: string,
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const ctx = await requirePermission("contacts.update");
  const t = await getTranslations();

  const parsed = contactFormSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const done = await updateContact(ctx, id, parsed.data);
  if (!done) return { error: t("contacts.notFound") };

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return { message: t("common.saveChanges") };
}

export async function deleteContactAction(id: string): Promise<void> {
  const ctx = await requirePermission("contacts.delete");
  await deleteContact(ctx, id);

  revalidatePath("/contacts");
  redirect("/contacts");
}

/**
 * Points a lead at a contact, or unlinks it.
 *
 * The lead keeps the details it arrived with either way, so unlinking loses
 * nothing: it only says the two are not the same person after all.
 */
export async function linkLeadToContactAction(
  leadId: string,
  contactId: string | null,
): Promise<ContactState> {
  const ctx = await requirePermission("leads.update");
  const t = await getTranslations();

  const done = await linkLeadToContact(ctx, leadId, contactId);
  if (!done) return { error: t("contacts.notFound") };

  revalidatePath(`/leads/${leadId}`);
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  return { message: t("common.saveChanges") };
}

export type ContactSearchItem = {
  id: string;
  label: string;
  description: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  clientCompanyId: string | null;
  clientCompanyName: string | null;
};

/** Backs the lead form's "existing contact" combobox — same gate the lead
 * form itself already requires to be on screen at all. */
export async function searchContactsAction(query: string): Promise<ContactSearchItem[]> {
  const ctx = await requirePermission("leads.read");
  const items = await searchContacts(ctx, query);
  return items.map((contact) => ({
    id: contact.id,
    label: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    description: contact.clientCompany?.name ?? contact.email ?? null,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    clientCompanyId: contact.clientCompanyId,
    clientCompanyName: contact.clientCompany?.name ?? null,
  }));
}
