import { dateRange, describeJobActivity, groupByDay } from "@nodo/core/jobs/timeline";
import { useLocale, useTranslations } from "use-intl";
import { personName } from "@/components/avatars";
import { formatDay } from "./format";
import type { ActivityRow, Person } from "./types";

/**
 * The job's timeline in the reader's words: the same `describeJobActivity`
 * the web runs (`@nodo/core/jobs/timeline`), with the same messages. People a
 * line mentions by id are named from the job's members; somebody who has left
 * since is "Somebody", where the web would look them up.
 */
export function useTimeline(members: Person[], formatLocale: string) {
  const t = useTranslations("jobs");
  const locale = useLocale();
  const names = new Map(members.map((member) => [member.id, personName(member)]));
  const translate = (key: string, values?: Record<string, string | number>) =>
    key.startsWith("status.") || ["dateRange", "startsOnly", "endsOnly", "noDates"].includes(key)
      ? t(key as never, values as never)
      : t(`timeline.${key}` as never, values as never);
  const list = (items: string[]) => joinNames(items, locale);

  return {
    describe: (row: ActivityRow) =>
      describeJobActivity({ type: row.type, params: row.params, actorName: row.actor ? personName(row.actor) : null }, translate, {
        nameOf: (id) => names.get(id) ?? t("timeline.someone"),
        list,
        formatDay: (day) => formatDay(day, formatLocale),
      }),
    dates: (start: string | null, end: string | null) => dateRange(start, end, translate, (day) => formatDay(day, formatLocale)),
  };
}

/** By day, in the company's zone, with the silence between days counted. */
export function timelineDays(rows: ActivityRow[], timeZone: string, now = new Date()) {
  return groupByDay(
    rows.map((row) => ({ row, createdAt: new Date(row.createdAt) })),
    timeZone,
    now,
  );
}

// `Intl.ListFormat` isn't in every Hermes; a comma list reads fine where it's missing.
function joinNames(items: string[], locale: string): string {
  const ListFormat = (Intl as { ListFormat?: typeof Intl.ListFormat }).ListFormat;
  return ListFormat ? new ListFormat(locale, { style: "long", type: "conjunction" }).format(items) : items.join(", ");
}
