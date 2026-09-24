"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
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
 * Aligns the cookie with the saved preference of the user who just signed in.
 * Without this, someone who chose Spanish would see their next session in
 * English until they chose it again.
 */
export async function syncLocaleAfterSignIn(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { language: true },
  });
  if (!user?.language) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, languageToLocale(user.language), {
    maxAge: ONE_YEAR,
    sameSite: "lax",
    path: "/",
  });
}
