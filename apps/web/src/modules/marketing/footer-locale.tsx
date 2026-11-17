"use client";

import { useTransition } from "react";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";

/**
 * The public page's language, as two plain links in the footer. The action
 * comes in as a prop: a client component importing a server action directly
 * is what breaks the Jest environment.
 */
export function FooterLocale({
  current,
  label,
  setLocale,
}: {
  current: Locale;
  label: string;
  setLocale: (locale: Locale) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <span className="text-white">{label}</span>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending || locale === current}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => startTransition(() => setLocale(locale))}
          className="transition hover:text-white disabled:cursor-default aria-[current=true]:text-white aria-[current=true]:underline aria-[current=true]:underline-offset-4"
        >
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
