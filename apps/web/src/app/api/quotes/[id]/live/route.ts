import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/session";
import { isViewingNow } from "@/modules/portal/share";
import { formatThread } from "@/modules/portal/thread";
import { livePollSeconds, type LiveFeed } from "@/modules/quotes/live";
import { visibilityWhere } from "@/modules/quotes/service";

/**
 * Everything on an open quote that the customer can change: whether they're on
 * it right now, and what they've written.
 *
 * It was two endpoints, polled side by side every 10s — two requests and two
 * session checks for one question asked about one quote. Still cheaper than a
 * persistent connection for something that moves a few times an hour, and
 * half of what it was.
 *
 * The answer also carries how long to wait before asking again
 * (`livePollSeconds`), so a quote accepted or a link revoked while the panel is
 * open slows or stops the poll without anybody reloading.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getCompanyContext();
  if (!ctx || !ctx.permissions.has("quotes.read")) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await context.params;

  // `ctx.db` keeps this to the company in the subdomain; `visibilityWhere` to
  // the quotes this profile may open at all — the same filter the page uses.
  const quote = await ctx.db.quote.findFirst({
    where: { id, ...visibilityWhere(ctx) },
    select: {
      status: true,
      share: {
        select: {
          viewing: true,
          lastSeenAt: true,
          openCount: true,
          revokedAt: true,
          expiresAt: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { authorUser: { select: { name: true, email: true } } },
      },
    },
  });

  if (!quote) return new NextResponse(null, { status: 404 });

  const feed: LiveFeed = {
    presence: quote.share
      ? {
          shared: true,
          viewingNow: isViewingNow(quote.share),
          openCount: quote.share.openCount,
          lastSeenAt: quote.share.lastSeenAt?.toISOString() ?? null,
        }
      : { shared: false, viewingNow: false, openCount: 0, lastSeenAt: null },
    messages: formatThread(quote.messages, {
      formatLocale: ctx.company.formatLocale,
      timezone: ctx.company.timezone,
      withAuthorNames: true,
    }),
    pollSeconds: livePollSeconds(quote.status, quote.share),
  };

  return NextResponse.json(feed);
}
