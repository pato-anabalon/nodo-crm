import { getLocale, getTranslations } from "next-intl/server";
import type { CompanyContext } from "@/lib/auth/session";
import type { JobActivityType } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { describeJobActivity } from "./timeline";
import { personName, type Person } from "./avatars";

type Row = { type: JobActivityType; params: unknown; actor: Person | null };

/**
 * Builds the sentence-writer for a set of timeline rows: the names of everyone
 * the rows mention are looked up once, and the words come from the reader's
 * language while the dates come from the company's format.
 */
export async function activityDescriber(ctx: CompanyContext, rows: Row[]) {
  const [t, locale] = await Promise.all([getTranslations("jobs"), getLocale()]);
  const tTimeline = (key: string, values?: Record<string, string | number>) =>
    key.startsWith("status.") || ["dateRange", "startsOnly", "endsOnly", "noDates"].includes(key)
      ? t(key, values)
      : t(`timeline.${key}`, values);

  const mentioned = new Set<string>();
  for (const row of rows) {
    const params = (row.params ?? {}) as Record<string, unknown>;
    if (Array.isArray(params.userIds)) params.userIds.forEach((id) => typeof id === "string" && mentioned.add(id));
    if (typeof params.userId === "string") mentioned.add(params.userId);
  }
  // By user rather than membership: somebody who has since left the company
  // still added who they added.
  const users = mentioned.size
    ? await ctx.db.user.findMany({ where: { id: { in: [...mentioned] } }, select: { id: true, name: true, email: true } })
    : [];
  const names = new Map(users.map((user) => [user.id, personName(user)]));
  const lists = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });

  return (row: Row) =>
    describeJobActivity({ type: row.type, params: row.params, actorName: row.actor ? personName(row.actor) : null }, tTimeline, {
      nameOf: (id) => names.get(id) ?? t("timeline.someone"),
      list: (items) => lists.format(items),
      formatDay: (day) => formatDate(new Date(`${day}T00:00:00Z`), ctx.company.formatLocale, "UTC"),
    });
}

