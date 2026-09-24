import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/session";
import { shareSummary } from "@/modules/portal/service";

/**
 * The customer's presence on a quote, for the company's panel.
 *
 * The panel polls it every few seconds. It's a single row read, which works out
 * cheaper than standing up a persistent connection to answer something that
 * changes once every several minutes.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getCompanyContext();
  if (!ctx || !ctx.permissions.has("quotes.read")) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await context.params;
  const summary = await shareSummary(ctx.company.id, id);

  if (!summary) return NextResponse.json({ shared: false });

  return NextResponse.json({
    shared: true,
    viewingNow: summary.viewingNow,
    openCount: summary.openCount,
    lastSeenAt: summary.lastSeenAt?.toISOString() ?? null,
  });
}
