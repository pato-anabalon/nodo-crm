import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeFromAcceptLanguage,
  type Locale,
} from "./config";

/**
 * The language isn't in the URL: the CRM is private, needs no SEO, and putting
 * `/en-GB/` in the path would mean touching the subdomain proxy.
 *
 * The source of truth is `User.language` (or the company's), but it's read here
 * from a cookie to avoid hitting the database on every request. The cookie is
 * refreshed at sign-in and whenever the language changes.
 */
export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const acceptLanguage = (await headers()).get("accept-language");
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async ({ locale, requestLocale }) => {
  /**
   * When someone asks for a specific language — `getTranslations({ locale })` —
   * they must get it. That's what lets a quote's email go out in the quote's
   * language and each internal notice arrive in its recipient's, regardless of
   * who triggered the action.
   *
   * Only when nobody asks does it fall back to the browser's preference.
   */
  const requested = locale ?? (await requestLocale);
  const resolved = isLocale(requested) ? requested : await resolveLocale();

  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
    now: new Date(),
  };
});
