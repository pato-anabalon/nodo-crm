"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { clientCompanyFormSchema } from "./schemas";
import {
  createClientCompany,
  deleteClientCompany,
  updateClientCompany,
} from "./service";

export type ClientCompanyState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Guarded by the contacts permissions rather than a family of its own: a
 * customer's company is part of the same address book, and a profile that can
 * see the people has no reason to be blind to who they work for.
 */
function values(formData: FormData) {
  return {
    name: formData.get("name"),
    taxId: formData.get("taxId"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    website: formData.get("website"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  };
}

export async function createClientCompanyAction(
  _prev: ClientCompanyState,
  formData: FormData,
): Promise<ClientCompanyState> {
  const ctx = await requirePermission("contacts.create");
  const t = await getTranslations();

  const parsed = clientCompanyFormSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const created = await createClientCompany(ctx, parsed.data);

  revalidatePath("/clients");
  redirect(`/clients/${created.id}`);
}

export async function updateClientCompanyAction(
  id: string,
  _prev: ClientCompanyState,
  formData: FormData,
): Promise<ClientCompanyState> {
  const ctx = await requirePermission("contacts.update");
  const t = await getTranslations();

  const parsed = clientCompanyFormSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const done = await updateClientCompany(ctx, id, parsed.data);
  if (!done) return { error: t("clients.notFound") };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { message: t("common.saveChanges") };
}

export async function deleteClientCompanyAction(id: string): Promise<void> {
  const ctx = await requirePermission("contacts.delete");
  await deleteClientCompany(ctx, id);

  revalidatePath("/clients");
  redirect("/clients");
}
