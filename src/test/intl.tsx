import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enGB from "../../messages/en-GB.json";
import es from "../../messages/es.json";
import type { Locale } from "@/i18n/config";

const MESSAGES = { "en-GB": enGB, es } as const;

/**
 * Renders with the real messages, not with doubles.
 *
 * That way component tests also fail when a translation key doesn't exist, which
 * is the easiest mistake to make when adding a screen.
 */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "en-GB" as Locale, ...options }: RenderOptions & { locale?: Locale } = {},
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {ui}
    </NextIntlClientProvider>,
    options,
  );
}

export { MESSAGES };
