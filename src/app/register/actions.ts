"use server";

import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { signupSchema } from "@/lib/auth/schemas";
import { createCompanyWithOwner, syncPermissions } from "@/lib/tenant/provision";
import { companyUrl, isReservedSlug, isValidSlug } from "@/lib/tenant/host";

export type RegisterState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  redirectTo?: string;
};

/**
 * Signing up a new company along with its owner user.
 *
 * It's the only entry point that creates a company, so the global Prisma client
 * is used here deliberately: there's no tenant to scope to yet.
 */
export async function registerCompany(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    companyName: formData.get("companyName"),
    companySlug: String(formData.get("companySlug") ?? "").toLowerCase().trim(),
  });

  const t = await getTranslations();

  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const { name, password, companyName, companySlug } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  if (!isValidSlug(companySlug) || isReservedSlug(companySlug)) {
    return { fieldErrors: { companySlug: [t("auth.slugUnavailable")] } };
  }

  const [existingCompany, existingUser] = await Promise.all([
    prisma.company.findUnique({ where: { slug: companySlug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);

  if (existingCompany) {
    return { fieldErrors: { companySlug: [t("auth.slugTaken")] } };
  }
  if (existingUser) {
    return { fieldErrors: { email: [t("auth.emailTaken")] } };
  }

  // The permissions table can be empty on a freshly deployed environment.
  await syncPermissions(prisma);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  await createCompanyWithOwner(prisma, {
    name: companyName,
    slug: companySlug,
    ownerUserId: user.id,
  });

  return { redirectTo: companyUrl(companySlug, "/login") };
}
