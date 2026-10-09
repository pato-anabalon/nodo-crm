"use server";

import bcrypt from "bcryptjs";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireCompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { meetsPasswordPolicy } from "@/lib/auth/password-policy";
import { MAX_IMAGE_BYTES, checkBrandImage, isStoredImage } from "@/modules/settings/brand-image";
import { avatarPathname } from "./avatar";
import { profileSchema } from "./schemas";

/**
 * The signed-in person's own data — name, photo, password. Guarded by
 * `requireCompanyContext()` for the session, same as everything else in the
 * app, but the writes go through `prisma` rather than `ctx.db`: a `User` row
 * belongs to no company (the same one can hold memberships in several), so
 * this is exactly the kind of platform-level task `ctx.db`'s tenant filter
 * was never meant to bound — the same reason registration and login use
 * `prisma` directly.
 */
export type AccountState = { error?: string; message?: string; fieldErrors?: Record<string, string[]> };

export async function updateProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const ctx = await requireCompanyContext();
  const t = await getTranslations();

  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  await prisma.user.update({ where: { id: ctx.user.id }, data: { name: parsed.data.name } });

  revalidatePath("/settings", "layout");
  const ts = await getTranslations("settings");
  return { message: ts("saved") };
}

export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("account.changePassword");
  const tp = await getTranslations("password");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  // `password` — the field `PasswordFields` posts under, the same component
  // the join and register screens use for a new password.
  const newPassword = String(formData.get("password") ?? "");

  if (!meetsPasswordPolicy(newPassword)) {
    return { fieldErrors: { newPassword: [tp("weak")] } };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
    select: { passwordHash: true },
  });

  // Somebody signing in by magic link alone, from before this account had a
  // password, sets one here with nothing to confirm it against yet.
  if (user.passwordHash) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return { fieldErrors: { currentPassword: [t("incorrectCurrent")] } };
  }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  return { message: t("changed") };
}

export async function uploadAvatarAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("account.avatar");

  const file = formData.get("avatar");
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

  const previous = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
    select: { image: true },
  });

  // The random suffix is what makes the new file a new URL — without it the
  // browser would go on showing the old photo from cache.
  const blob = await put(avatarPathname(ctx.user.id, file.type), file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  await prisma.user.update({ where: { id: ctx.user.id }, data: { image: blob.url } });

  // The old file goes after the new one is in place: an orphan in the store
  // costs a few kilobytes, a broken avatar mid-upload would not.
  if (isStoredImage(previous.image)) await del(previous.image!).catch(() => undefined);

  revalidatePath("/settings", "layout");
  return { message: t("uploaded") };
}

export async function removeAvatarAction(): Promise<AccountState> {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("account.avatar");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
    select: { image: true },
  });
  if (!user.image) return { error: t("errors.none") };

  await prisma.user.update({ where: { id: ctx.user.id }, data: { image: null } });
  if (isStoredImage(user.image)) await del(user.image).catch(() => undefined);

  revalidatePath("/settings", "layout");
  return { message: t("removed") };
}
