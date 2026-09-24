import { getTranslations } from "next-intl/server";
import { ActivityType, LeadStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";

export type ActivityEntry = {
  id: string;
  type: ActivityType;
  content: string;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
};

/**
 * The lead's activity log.
 *
 * Only notes written by a person carry text of their own; the rest of the events
 * are translated from their type, so the same log reads in the language of
 * whoever is looking at it.
 */
export async function LeadActivityLog({
  activities,
  formatLocale,
  timezone,
}: {
  activities: ActivityEntry[];
  formatLocale: string;
  timezone: string;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations("leads"),
    getTranslations("common"),
  ]);

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("notes.empty")}</p>;
  }

  return (
    <ol className="space-y-3">
      {activities.map((activity) => (
        <li key={activity.id} className="rounded-lg border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{activity.user?.name ?? activity.user?.email ?? tCommon("system")}</span>
            <time dateTime={activity.createdAt.toISOString()}>
              {formatDateTime(activity.createdAt, formatLocale, timezone)}
            </time>
          </div>
          <p className="mt-1.5 text-sm whitespace-pre-wrap">{describe(activity, t)}</p>
        </li>
      ))}
    </ol>
  );
}

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Translates a status, or shows it as written.
 *
 * The log renders text somebody else wrote into the database, sometimes years
 * ago and sometimes by a version of the code that formatted it differently.
 * Asking for a message key built from that text is how a history entry took the
 * whole page down with `MISSING_MESSAGE`. A line nobody can translate is worth
 * showing raw; it is never worth crashing over.
 */
function leadStatusName(value: string | undefined, t: Translator): string {
  if (!value) return "";
  return isLeadStatus(value) ? t(`status.${value}`) : value;
}

function isLeadStatus(value: string): boolean {
  return (Object.values(LeadStatus) as string[]).includes(value);
}

export function describe(
  activity: Pick<ActivityEntry, "type" | "content">,
  t: Translator,
): string {
  switch (activity.type) {
    // A person wrote it: shown verbatim.
    case ActivityType.NOTE:
    case ActivityType.CALL:
    case ActivityType.EMAIL:
    case ActivityType.MEETING:
      return activity.content;

    case ActivityType.STATUS_CHANGE: {
      const [from, to] = activity.content.split(">");
      return t("activity.STATUS_CHANGE", {
        from: leadStatusName(from, t),
        to: leadStatusName(to, t),
      });
    }

    case ActivityType.QUOTE_DECIDED: {
      const [number, status] = activity.content.split(">");
      return t("activity.QUOTE_DECIDED", {
        reference: number ?? "",
        status: status ?? "",
      });
    }

    case ActivityType.ASSIGNED:
      return activity.content
        ? t("activity.ASSIGNED", { name: activity.content })
        : t("activity.UNASSIGNED");

    case ActivityType.DISCARDED:
      // The reason is free text; if none was written, the event is enough.
      return activity.content
        ? `${t("activity.DISCARDED")} — ${activity.content}`
        : t("activity.DISCARDED");

    case ActivityType.CONVERTED:
      return t("activity.CONVERTED", { reference: activity.content });

    default:
      return t(`activity.${activity.type}`);
  }
}
