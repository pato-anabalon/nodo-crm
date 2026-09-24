import { after } from "next/server";
import { NextResponse } from "next/server";
import { recordOpen, resolveShare, touchPresence } from "@/modules/portal/service";
import { notifyQuoteOpened } from "@/modules/notifications/service";

/**
 * Heartbeat from the customer's page.
 *
 * Marks "looking at it now" in the company's panel. It's an update of one row,
 * not an insert: keeping this cheap is what makes presence solvable without
 * real-time infrastructure.
 *
 * **The first beat of a page load also records the opening.** That used to
 * happen in the page itself, which turned out to count renders rather than
 * visits: every action in the portal revalidates the page, so a customer who
 * opened a quote once and then sent three messages and accepted it appeared to
 * have opened it five times — in the event log and in the counter beside
 * "viewing now", which is real.
 *
 * The trade is that somebody browsing with JavaScript off stops being counted.
 * They could never have accepted or replied either, so the portal was already
 * theirs to read and nothing else.
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) {
    return new NextResponse(null, { status: 204 });
  }

  const first = new URL(request.url).searchParams.get("first") === "1";

  if (first) {
    const headers = request.headers;
    after(async () => {
      await recordOpen({
        shareId: share.id,
        companyId: share.companyId,
        quoteId: share.quoteId,
        ipAddress: headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: headers.get("user-agent"),
      });
      await notifyQuoteOpened(share.quoteId);
    });
  } else {
    await touchPresence(share.id);
  }

  return new NextResponse(null, { status: 204 });
}
