import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/session";
import { formatThread } from "@/modules/portal/thread";

/**
 * The quote's thread, for the company's panel.
 *
 * Polled while the panel is open so a reply from the customer turns up without
 * anyone reloading. Like presence, it's a short read of one quote's messages,
 * which is cheaper than holding a connection open for a conversation that moves
 * a few times an hour.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getCompanyContext();
  if (!ctx || !ctx.permissions.has("quotes.read")) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await context.params;

  // `ctx.db` is what keeps this to the company in the subdomain.
  const quote = await ctx.db.quote.findFirst({
    where: { id },
    select: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { authorUser: { select: { name: true, email: true } } },
      },
    },
  });

  if (!quote) return new NextResponse(null, { status: 404 });

  return NextResponse.json({
    messages: formatThread(quote.messages, {
      formatLocale: ctx.company.formatLocale,
      timezone: ctx.company.timezone,
      withAuthorNames: true,
    }),
  });
}
