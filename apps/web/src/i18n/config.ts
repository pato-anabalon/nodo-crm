import { Language } from "@/generated/prisma/enums";

/**
 * Interface languages.
 *
 * In the database they live as an enum (`EN_GB`), and in the UI as a BCP 47 tag
 * (`en-GB`), which is what `Intl` and next-intl understand. This module is the
 * only place that translates between the two.
 */

export const LOCALES = ["en-GB", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en-GB";

/** Each language's name in its own language, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  "en-GB": "English (UK)",
  es: "Español",
};

/** Cookie caching the language so the database isn't queried on every request. */
export const LOCALE_COOKIE = "nodo_lang";

const LANGUAGE_TO_LOCALE: Record<Language, Locale> = {
  [Language.EN_GB]: "en-GB",
  [Language.ES]: "es",
};

const LOCALE_TO_LANGUAGE: Record<Locale, Language> = {
  "en-GB": Language.EN_GB,
  es: Language.ES,
};

export function languageToLocale(language: Language): Locale {
  return LANGUAGE_TO_LOCALE[language];
}

export function localeToLanguage(locale: Locale): Language {
  return LOCALE_TO_LANGUAGE[locale];
}

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * Picks the best available language from an `Accept-Language` header.
 * It only looks at the language subtype: `en-US` and `en-AU` both land on `en-GB`.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  const entries = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of entries) {
    if (tag.startsWith("es")) return "es";
    if (tag.startsWith("en")) return "en-GB";
  }
  return null;
}
