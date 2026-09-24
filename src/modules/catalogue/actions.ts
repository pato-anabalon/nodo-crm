"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { catalogueItemSchema } from "./schemas";
import {
  createCatalogueItem,
  setCatalogueItemActive,
  updateCatalogueItem,
} from "./service";

export type CatalogueState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function values(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    unit: formData.get("unit"),
    unitPrice: formData.get("unitPrice"),
  };
}

export async function createCatalogueItemAction(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = catalogueItemSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await createCatalogueItem(ctx, parsed.data);

  revalidatePath("/settings/catalogue");
  return { message: t("catalogue.added") };
}

export async function updateCatalogueItemAction(
  id: string,
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = catalogueItemSchema.safeParse(values(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const done = await updateCatalogueItem(ctx, id, parsed.data);
  if (!done) return { error: t("catalogue.notFound") };

  revalidatePath("/settings/catalogue");
  return { message: t("common.saveChanges") };
}

export async function setCatalogueItemActiveAction(
  id: string,
  active: boolean,
): Promise<CatalogueState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("catalogue");

  const done = await setCatalogueItemActive(ctx, id, active);
  if (!done) return { error: t("notFound") };

  revalidatePath("/settings/catalogue");
  return { message: active ? t("restored") : t("retired") };
}
