import { elapsed } from "@nodo/core/relative-time";
import { useTranslations } from "use-intl";

/**
 * Words are the reader's language; dates are the company's format
 * (`formatLocale`), the same split the web makes. A day travels as
 * `YYYY-MM-DD` and is already the company's own calendar day, so it is drawn
 * in UTC — reading it in the phone's zone could move it a day.
 */
export function formatDay(day: string, formatLocale: string): string {
  return new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

export function useElapsed(formatLocale: string, timeZone: string) {
  const t = useTranslations("common.elapsed");
  return (iso: string) => {
    const at = new Date(iso);
    const gap = elapsed(at);
    if (gap.unit === "date") {
      return new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "short", timeZone }).format(at);
    }
    return gap.unit === "now" ? t("now") : t(gap.unit, { value: gap.value });
  };
}
