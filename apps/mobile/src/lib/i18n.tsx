import "@formatjs/intl-getcanonicallocales/polyfill.js";
import "@formatjs/intl-locale/polyfill.js";
import "@formatjs/intl-pluralrules/polyfill.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
import en from "@nodo/messages/en-GB.json";
import es from "@nodo/messages/es.json";
import { getLocales } from "expo-localization";
import type { ReactNode } from "react";
import { createTranslator, IntlProvider } from "use-intl";

/**
 * The same messages the web renders, through use-intl — next-intl's own core,
 * so an ICU `select` or `plural` reads identically on both sides. Hermes ships
 * no `Intl.PluralRules` of its own on every version; the polyfills above only
 * install themselves where it's missing.
 *
 * The language is the person's (`/me`, with the company's as fallback). Before
 * sign-in nobody knows it yet, so the phone's own language decides.
 */
export type Locale = "en-GB" | "es";

const MESSAGES = { "en-GB": en, es } as const;

export function deviceLocale(tags: string[] = getLocales().map((locale) => locale.languageCode ?? "")): Locale {
  return tags[0]?.toLowerCase().startsWith("es") ? "es" : "en-GB";
}

export function I18n({ locale, timeZone, children }: { locale: Locale; timeZone?: string; children: ReactNode }) {
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]} timeZone={timeZone} onError={reportOnly}>
      {children}
    </IntlProvider>
  );
}

/** The messages outside React: a background task wording a notice in the person's language. */
export function translator(locale: Locale) {
  return createTranslator({ locale, messages: MESSAGES[locale], onError: reportOnly });
}

// A missing message shows its key rather than taking the screen down; the
// messages tests are where it is caught.
function reportOnly(error: Error) {
  if (__DEV__) console.warn(error.message);
}
