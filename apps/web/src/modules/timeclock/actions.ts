"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RETURN_MINUTES_OPTIONS, SWITCH_MINUTES_OPTIONS, TRAVEL_MAX_MINUTES_OPTIONS } from "@nodo/core/timeclock/movement";
import { MEAL_BREAK_OPTIONS, REST_BREAK_OPTIONS } from "@nodo/core/timeclock/pay";
import { LOCATION_RETENTION_DAYS_OPTIONS } from "@nodo/core/timeclock/track";
import { can, ForbiddenError, requirePermission, type CompanyContext } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { shiftWindow } from "./corrections";
import { addShift, adjustMeal, correctShift, deleteShift } from "./corrections-service";
import { TimeclockRefusal } from "./errors";
import { parseHourlyRate } from "./rate";
import { deleteShiftSchema, mealSchema, shiftSchema } from "./schemas";

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
 * What the clock does when somebody leaves the job mid-shift: how long before
 * it ends the shift (0 never), how long inside another job before the phone
 * offers to switch, and how long travel runs before it ends by itself.
 */
export async function saveMovementPolicyAction(_prev: TimeclockState, formData: FormData): Promise<TimeclockState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("timeclockSettings");

  const siteReturnMinutes = oneOf(RETURN_MINUTES_OPTIONS, formData.get("returnMinutes"));
  const siteSwitchMinutes = oneOf(SWITCH_MINUTES_OPTIONS, formData.get("switchMinutes"));
  const travelMaxMinutes = oneOf(TRAVEL_MAX_MINUTES_OPTIONS, formData.get("travelMaxMinutes"));
  if (siteReturnMinutes === null || siteSwitchMinutes === null || travelMaxMinutes === null) return { error: t("invalid") };

  await ctx.db.company.update({ where: { id: ctx.company.id }, data: { siteReturnMinutes, siteSwitchMinutes, travelMaxMinutes } });
  revalidatePath("/settings", "layout");
  return { message: t("movementSaved") };
}

/** How long a shift's positions are kept before the sweep thins them into one line. */
export async function saveRetentionAction(_prev: TimeclockState, formData: FormData): Promise<TimeclockState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("timeclockSettings");

  const locationRetentionDays = oneOf(LOCATION_RETENTION_DAYS_OPTIONS, formData.get("retentionDays"));
  if (locationRetentionDays === null) return { error: t("invalid") };

  await ctx.db.company.update({ where: { id: ctx.company.id }, data: { locationRetentionDays } });
  revalidatePath("/settings", "layout");
  return { message: t("retentionSaved") };
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

/*
 * Corrections (`timeclock.update`). Each says why, and each refusal — a shift
 * over another, in the future, one's own hours — is a sentence on the form,
 * not an error page: the person is in the middle of putting something right.
 */

async function correcting<T>(
  formData: FormData,
  schema: z.ZodType<T>,
  act: (ctx: CompanyContext, values: T) => Promise<TimeclockState | void>,
): Promise<TimeclockState> {
  const ctx = await requirePermission("timeclock.update");
  const t = await getTranslations();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  try {
    const result = await act(ctx, parsed.data);
    revalidatePath("/timesheets", "layout");
    return result ?? { message: t("timesheets.corrections.saved") };
  } catch (error) {
    if (error instanceof TimeclockRefusal) return { error: t(`timesheets.corrections.errors.${error.code}`) };
    throw error;
  }
}

/** A shift entered by hand for `userId`. */
export async function addShiftAction(userId: string, _prev: TimeclockState, formData: FormData): Promise<TimeclockState> {
  return correcting(formData, shiftSchema, async (ctx, values) => {
    const window = shiftWindow(values.day, values.start, values.end, ctx.company.timezone);
    await addShift(ctx, userId, { jobId: values.jobId, window, reason: values.reason });
  });
}

export async function correctShiftAction(entryId: string, _prev: TimeclockState, formData: FormData): Promise<TimeclockState> {
  return correcting(formData, shiftSchema, async (ctx, values) => {
    const window = shiftWindow(values.day, values.start, values.end, ctx.company.timezone);
    await correctShift(ctx, entryId, { jobId: values.jobId, window, reason: values.reason });
  });
}

/** Takes the shift off and goes back to the person's week: its own page no longer exists. */
export async function deleteShiftAction(entryId: string, week: string, _prev: TimeclockState, formData: FormData): Promise<TimeclockState> {
  let userId: string | null = null;
  const state = await correcting(formData, deleteShiftSchema, async (ctx, values) => {
    userId = await deleteShift(ctx, entryId, values.reason);
  });
  if (userId) redirect(`/timesheets/${userId}?week=${week}`);
  return state;
}

/** The meal break of one of `userId`'s days; empty minutes go back to the company's. */
export async function adjustMealAction(userId: string, _prev: TimeclockState, formData: FormData): Promise<TimeclockState> {
  return correcting(formData, mealSchema, async (ctx, values) => {
    await adjustMeal(ctx, userId, values.day, values.minutes, values.reason);
  });
}
