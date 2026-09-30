"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { setCompanyActive } from "./service";

export type PlatformState = { message?: string; error?: string };

export async function setCompanyActiveAction(
  companyId: string,
  isActive: boolean,
): Promise<PlatformState> {
  await requirePlatformAdmin();
  await setCompanyActive(companyId, isActive);
  revalidatePath("/admin");

  const t = await getTranslations("platform");
  return { message: isActive ? t("activated") : t("suspended") };
}
