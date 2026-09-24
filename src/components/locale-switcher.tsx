"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

/** Each language in its own language: nobody looks for "Spanish" while in Spanish. */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const [pending, startTransition] = useTransition();

  return (
    <>
      {LOCALES.map((locale) => (
        <DropdownMenuItem
          key={locale}
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(() => setLocale(locale));
          }}
          className="cursor-pointer justify-between"
        >
          {LOCALE_NAMES[locale]}
          {locale === current ? <Check className="size-4" /> : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}
