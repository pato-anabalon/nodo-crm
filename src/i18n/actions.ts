"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { currentCompanySlug } from "@/lib/auth/session";
import { LOCALE_COOKIE, isLocale, languageToLocale, localeToLanguage, type Locale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Leaves the chosen language in the cookie `getRequestConfig` reads, and persists
 * it on the user so it survives in another browser. The database is the source
 * of truth; the cookie exists to avoid querying it on every request.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR,
    sameSite: "lax",
    path: "/",
  });

  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { language: localeToLanguage(locale) },
    });
  }

  revalidatePath("/", "layout");
}

/**
 * Aligns the cookie with the saved preference of the user who just signed in,
 * or with the company's when they have none of their own — `User.language` is
 * null precisely to mean "inherit the company's". Without the fallback, a
 * user's very first sign-in leaves the cookie untouched, and whoever set it
 * last was `resolveLocale()` guessing from the browser's `Accept-Language`,
 * not the company's configured language.
 */
export async function syncLocaleAfterSignIn(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const slug = await currentCompanySlug();
  const [user, company] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { language: true } }),
    slug
      ? prisma.company.findUnique({ where: { slug }, select: { defaultLanguage: true } })
      : Promise.resolve(null),
  ]);

  const language = user?.language ?? company?.defaultLanguage;
  if (!language) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, languageToLocale(language), {
    maxAge: ONE_YEAR,
    sameSite: "lax",
    path: "/",
  });
}
