import { markAllRead } from "@/modules/notifications/inbox";
import { mobileRoute } from "@/modules/mobile/route";

/** Everything in this company's bell, read. */
export const POST = mobileRoute({
  handler: async ({ ctx }) => ({ marked: await markAllRead(ctx) }),
});
