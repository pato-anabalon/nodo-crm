"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { activateCompany, convertToCustomer, setDemoDays, suspendCompany } from "./service";
import { isValidDemoDays } from "./status";

export type PlatformState = { message?: string; error?: string };

/**
 * Switches a company on: with no limit, or as a demo of `days` days.
 *
 * The days are checked here and not only in the dialog — this is called with
 * plain arguments, so a hand-made call is checked against the same limits as the
 * input that offered them.
 */
export async function activateCompanyAction(
  companyId: string,
  input: { demo: boolean; days?: number },
): Promise<PlatformState> {
  await requirePlatformAdmin();
  const t = await getTranslations("platform");

  if (input.demo && !isValidDemoDays(input.days)) return { error: t("errors.demoDays") };

  await activateCompany(companyId, input.demo ? { days: input.days as number } : null);
  revalidatePath("/admin");
  return { message: t("activated") };
}

export async function suspendCompanyAction(companyId: string): Promise<PlatformState> {
  await requirePlatformAdmin();
  await suspendCompany(companyId);
  revalidatePath("/admin");

  const t = await getTranslations("platform");
  return { message: t("suspended") };
}

export async function setDemoDaysAction(companyId: string, days: number): Promise<PlatformState> {
  await requirePlatformAdmin();
  const t = await getTranslations("platform");

  if (!isValidDemoDays(days)) return { error: t("errors.demoDays") };
  if (!(await setDemoDays(companyId, days))) return { error: t("errors.notADemo") };

  revalidatePath("/admin");
  return { message: t("demoSaved") };
}

export async function convertToCustomerAction(companyId: string): Promise<PlatformState> {
  await requirePlatformAdmin();
  const t = await getTranslations("platform");

  if (!(await convertToCustomer(companyId))) return { error: t("errors.notADemo") };

  revalidatePath("/admin");
  return { message: t("converted") };
}
