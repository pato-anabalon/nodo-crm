"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import {
  acceptanceSettingsSchema,
  checkbox,
  companyProfileSchema,
  quoteSettingsSchema,
  reviewSchema,
} from "./schemas";
import {
  MAX_IMAGE_BYTES,
  brandImagePathname,
  checkBrandImage,
  isStoredImage,
  type BrandImage,
} from "./brand-image";

export type SettingsState = { error?: string; message?: string; fieldErrors?: Record<string, string[]> };

async function saved(): Promise<SettingsState> {
  const t = await getTranslations("settings");
  return { message: t("saved") };
}

export async function saveCompanyProfileAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = companyProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await ctx.db.company.update({ where: { id: ctx.company.id }, data: parsed.data });

  revalidatePath("/settings", "layout");
  return saved();
}


/**
 * Replaces the company's logo with an uploaded file.
 *
 * The URL of the stored file goes into the same `logoUrl` every screen already
 * reads, so the sidebar, the login page and the customer's quote pick it up
 * without knowing where it came from.
 */
/**
 * Upload and removal for both brand images, written once.
 *
 * Logo and watermark differ only in which column they land in and which texts
 * are shown; everything that is easy to get wrong — the random suffix, the
 * order of write and delete, refusing to delete somebody else's file — is the
 * same for both and should only exist once.
 */
const COLUMN = { logo: "logoUrl", watermark: "watermarkUrl" } as const;

async function uploadBrandImage(
  kind: BrandImage,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations(`settings.${kind}`);

  const file = formData.get(kind);
  if (!(file instanceof File)) return { error: t("errors.empty") };

  const check = checkBrandImage(file);
  if (!check.ok) {
    return {
      error:
        check.reason === "type"
          ? t("errors.type")
          : check.reason === "size"
            ? t("errors.size", { max: MAX_IMAGE_BYTES / (1024 * 1024) })
            : t("errors.empty"),
    };
  }

  const previous = ctx.company[COLUMN[kind]];

  // The random suffix is what makes the new file a new URL. Without it the
  // browser and the CDN would go on showing the old image from cache.
  const blob = await put(brandImagePathname(ctx.company.id, kind, file.type), file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  await ctx.db.company.update({
    where: { id: ctx.company.id },
    data: { [COLUMN[kind]]: blob.url },
  });

  // The old file goes after the new one is in place: an orphan in the store
  // costs a few kilobytes, whereas a company with no logo shows on every page.
  if (isStoredImage(previous)) await del(previous!).catch(() => undefined);

  revalidatePath("/settings", "layout");
  return { message: t("uploaded") };
}

async function removeBrandImage(kind: BrandImage): Promise<SettingsState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations(`settings.${kind}`);

  const previous = ctx.company[COLUMN[kind]];
  if (!previous) return { error: t("errors.none") };

  await ctx.db.company.update({
    where: { id: ctx.company.id },
    data: { [COLUMN[kind]]: null },
  });

  // Only ours is deleted: a company pointing at its own CDN keeps that file.
  if (isStoredImage(previous)) await del(previous).catch(() => undefined);

  revalidatePath("/settings", "layout");
  return { message: t("removed") };
}

export async function uploadLogoAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  return uploadBrandImage("logo", formData);
}

/** Removes the logo and falls back to the initials. */
export async function removeLogoAction(): Promise<SettingsState> {
  return removeBrandImage("logo");
}

export async function uploadWatermarkAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  return uploadBrandImage("watermark", formData);
}

/** Removes the watermark; the quote simply stops carrying one. */
export async function removeWatermarkAction(): Promise<SettingsState> {
  return removeBrandImage("watermark");
}

export async function saveQuoteSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = quoteSettingsSchema.safeParse({
    ...Object.fromEntries(formData),
    pricesIncludeTax: checkbox(formData, "pricesIncludeTax"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await ctx.db.company.update({ where: { id: ctx.company.id }, data: parsed.data });

  revalidatePath("/settings", "layout");
  return saved();
}

export async function saveAcceptanceSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = acceptanceSettingsSchema.safeParse({
    ...Object.fromEntries(formData),
    requireSignature: checkbox(formData, "requireSignature"),
    askAdditionalComments: checkbox(formData, "askAdditionalComments"),
    askOrderReference: checkbox(formData, "askOrderReference"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await ctx.db.company.update({ where: { id: ctx.company.id }, data: parsed.data });

  revalidatePath("/settings", "layout");
  return saved();
}

export async function saveReviewAction(
  id: string | null,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations();

  const parsed = reviewSchema.safeParse({
    ...Object.fromEntries(formData),
    featured: checkbox(formData, "featured"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  if (id) {
    // `ctx.db` guarantees the review belongs to this company.
    const { count } = await ctx.db.companyReview.updateMany({ where: { id }, data: parsed.data });
    if (count === 0) return { error: t("settings.errors.reviewNotFound") };
  } else {
    const last = await ctx.db.companyReview.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    await ctx.db.companyReview.create({
      data: { ...parsed.data, companyId: ctx.company.id, position: (last?.position ?? -1) + 1 },
    });
  }

  revalidatePath("/settings/reviews");
  return saved();
}

export async function deleteReviewAction(id: string): Promise<SettingsState> {
  const ctx = await requirePermission("settings.update");

  const { count } = await ctx.db.companyReview.deleteMany({ where: { id } });

  revalidatePath("/settings/reviews");
  if (count === 0) {
    const t = await getTranslations("settings");
    return { error: t("errors.reviewNotFound") };
  }
  return {};
}
