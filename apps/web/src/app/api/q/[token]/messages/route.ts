import { NextResponse } from "next/server";
import { resolveShare } from "@/modules/portal/service";
import { formatThread } from "@/modules/portal/thread";

/**
 * The quote's thread, for the customer.
 *
 * The link is the only credential, exactly as on the page itself: a closed or
 * expired one stops answering here too, so revoking really does end the
 * conversation rather than just hiding the page.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) return new NextResponse(null, { status: 404 });

  return NextResponse.json({
    messages: formatThread(share.quote.messages, {
      formatLocale: share.company.formatLocale,
      timezone: share.company.timezone,
      withAuthorNames: false,
    }),
  });
}
