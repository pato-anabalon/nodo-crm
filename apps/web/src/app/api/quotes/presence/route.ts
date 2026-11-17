import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/session";
import { isViewingNow } from "@/modules/portal/share";

/** One page of quotes is 20; the cap is only here to bound a hand-made request. */
const MAX_IDS = 50;

/**
 * Presence for a list of quotes, in one request.
 *
 * The list polls this rather than asking per row: twenty quotes on screen would
 * otherwise be twenty requests every few seconds, which is how a cheap idea
 * becomes an expensive one.
 */
export async function GET(request: Request) {
  const ctx = await getCompanyContext();
  if (!ctx || !ctx.permissions.has("quotes.read")) {
    return new NextResponse(null, { status: 401 });
  }

  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (ids.length === 0) return NextResponse.json({});

  // `ctx.db` bounds this to the company: an id from elsewhere simply finds
  // nothing, so the response can't confirm that another company's quote exists.
  const shares = await ctx.db.quoteShare.findMany({
    where: { quoteId: { in: ids } },
    select: { quoteId: true, openCount: true, lastSeenAt: true, viewing: true },
  });

  const presence: Record<string, { viewingNow: boolean; openCount: number }> = {};
  for (const share of shares) {
    presence[share.quoteId] = {
      viewingNow: isViewingNow(share),
      openCount: share.openCount,
    };
  }

  return NextResponse.json(presence);
}
