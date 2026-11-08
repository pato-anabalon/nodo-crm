import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCompanyContext } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { listInbox, unreadCount } from "@/modules/notifications/inbox";
import { syncDueTasks } from "@/modules/tasks/service";

/**
 * What the bell shows.
 *
 * Overdue tasks are turned into notices here rather than by a scheduled job: the
 * bell is polled only while somebody has the app open, which is exactly when a
 * notice can be read. Email for the same thing would need a scheduler.
 *
 * The text is rendered here and not in the browser because a notice stores its
 * kind and parameters, never a sentence — so it reads in whoever's language is
 * asking, even if that changed after it was created.
 */
export async function GET() {
  const ctx = await getCompanyContext();
  if (!ctx) return new NextResponse(null, { status: 401 });

  await syncDueTasks(ctx);

  const [items, unread, t] = await Promise.all([
    listInbox(ctx),
    unreadCount(ctx),
    getTranslations({ locale: ctx.locale, namespace: "notifications.inApp" }),
  ]);

  return NextResponse.json({
    unread,
    items: items.map((item) => ({
      id: item.id,
      text: t(item.kind, (item.params ?? {}) as Record<string, string>),
      href: item.href,
      read: item.readAt !== null,
      at: formatDateTime(item.createdAt, ctx.company.formatLocale, ctx.company.timezone),
    })),
  });
}
