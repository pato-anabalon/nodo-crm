"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { MEAL_BREAK_OPTIONS, REST_BREAK_OPTIONS } from "@nodo/core/timeclock/pay";
import { can, ForbiddenError, requirePermission } from "@/lib/auth/session";
import { parseHourlyRate } from "./rate";

export type TimeclockState = { error?: string; message?: string; fieldErrors?: Record<string, string[]> };

const oneOf = (options: readonly number[], value: FormDataEntryValue | null) => {
  const number = Number(value);
  return options.includes(number) ? number : null;
};

/** How long the company's breaks last. Which breaks a day carries is the law's, not a setting. */
export async function saveBreakPolicyAction(_prev: TimeclockState, formData: FormData): Promise<TimeclockState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("timeclockSettings");

  const restBreakMinutes = oneOf(REST_BREAK_OPTIONS, formData.get("restBreakMinutes"));
  const mealBreakMinutes = oneOf(MEAL_BREAK_OPTIONS, formData.get("mealBreakMinutes"));
  if (restBreakMinutes === null || mealBreakMinutes === null) return { error: t("invalid") };

  await ctx.db.company.update({ where: { id: ctx.company.id }, data: { restBreakMinutes, mealBreakMinutes } });
  revalidatePath("/settings", "layout");
  revalidatePath("/timesheets", "layout");
  return { message: t("saved") };
}

/**
 * What a person is paid an hour here. Pay is taken out by `timeclock.export`,
 * so setting it asks for that as well as `users.update`. Empty clears it.
 */
export async function setHourlyRateAction(userId: string, _prev: TimeclockState, formData: FormData): Promise<TimeclockState> {
  const ctx = await requirePermission("users.update");
  if (!can(ctx, "timeclock.export")) throw new ForbiddenError("timeclock.export");
  const t = await getTranslations("team.rate");

  const rate = parseHourlyRate(String(formData.get("hourlyRate") ?? ""));
  if (rate === undefined) return { fieldErrors: { hourlyRate: [t("invalid")] } };

  const { count } = await ctx.db.membership.updateMany({ where: { userId }, data: { hourlyRate: rate } });
  if (count === 0) return { error: t("notFound") };
  revalidatePath("/settings/team");
  revalidatePath("/timesheets", "layout");
  return { message: t("saved") };
}
