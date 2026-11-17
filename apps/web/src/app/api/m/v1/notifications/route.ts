import { listInbox, unreadCount } from "@/modules/notifications/inbox";
import { syncDueTasks } from "@/modules/tasks/service";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * The bell, for the app: this company's latest notices and how many are
 * unread. Each is its kind and parameters, as stored — the app words it with
 * `notifications.inApp.<kind>` from `@nodo/messages`, the same message the web
 * renders — and `href` is the web's path, which the app maps to its screen.
 * Overdue tasks become notices here as they do when the web's bell is asked.
 */
export const GET = mobileRoute({
  handler: async ({ ctx }) => {
    await syncDueTasks(ctx);
    const [items, unread] = await Promise.all([listInbox(ctx), unreadCount(ctx)]);
    return {
      unread,
      items: items.map((item) => ({
        id: item.id,
        kind: item.kind,
        params: item.params ?? {},
        href: item.href,
        read: item.readAt !== null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  },
});
