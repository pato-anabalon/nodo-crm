"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireCompanyContext, requirePermission } from "@/lib/auth/session";
import { isNotificationKind } from "./preferences";
import { addExtraRecipient, removeExtraRecipient } from "./extra-recipients";
import { markAllRead, markRead } from "./inbox";

export type PreferenceState = { error?: string };

/**
 * Turns one kind of notice on or off for the person signed in.
 *
 * It needs no permission: these are their own emails, not company settings.
 * `ctx.db` still scopes the write, so nobody can change someone else's.
 */
export async function setNotificationPreferenceAction(
  kind: string,
  enabled: boolean,
): Promise<PreferenceState> {
  const ctx = await requireCompanyContext();
  if (!isNotificationKind(kind)) return { error: "Unknown notification kind" };

  await ctx.db.notificationPreference.upsert({
    where: {
      userId_companyId_kind: { userId: ctx.user.id, companyId: ctx.company.id, kind },
    },
    create: { userId: ctx.user.id, companyId: ctx.company.id, kind, enabled },
    update: { enabled },
  });

  revalidatePath("/settings/notifications");
  return {};
}

export type RecipientState = { error?: string; message?: string };

/**
 * Adds one address to the company's list for new leads.
 *
 * Needs `settings.update`, unlike the preferences above: this decides who else
 * in the world receives the company's leads, which is not a personal choice.
 */
export async function addLeadRecipientAction(
  _prev: RecipientState,
  formData: FormData,
): Promise<RecipientState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("notificationSettings.recipients");

  const company = await ctx.db.company.findFirstOrThrow({
    where: { id: ctx.company.id },
    select: { leadNotificationEmails: true },
  });

  const result = addExtraRecipient(company.leadNotificationEmails, String(formData.get("email") ?? ""));
  if (!result.ok) return { error: t(`errors.${result.reason}`) };

  await ctx.db.company.update({
    where: { id: ctx.company.id },
    data: { leadNotificationEmails: result.list },
  });

  revalidatePath("/settings/notifications");
  return { message: t("added") };
}

export async function removeLeadRecipientAction(email: string): Promise<RecipientState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("notificationSettings.recipients");

  const company = await ctx.db.company.findFirstOrThrow({
    where: { id: ctx.company.id },
    select: { leadNotificationEmails: true },
  });

  await ctx.db.company.update({
    where: { id: ctx.company.id },
    data: { leadNotificationEmails: removeExtraRecipient(company.leadNotificationEmails, email) },
  });

  revalidatePath("/settings/notifications");
  return { message: t("removed") };
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const ctx = await requireCompanyContext();
  await markRead(ctx, id);
}

export async function markAllReadAction(): Promise<void> {
  const ctx = await requireCompanyContext();
  await markAllRead(ctx);
}
