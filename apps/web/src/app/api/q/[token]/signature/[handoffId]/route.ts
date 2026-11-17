import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveShare } from "@/modules/portal/service";
import { handoffState } from "@/modules/portal/signature";

/**
 * The computer asking whether the phone sent anything new.
 *
 * Answers to the quote's own link and checks the handoff is that quote's:
 * knowing a handoff id is not enough to read somebody else's strokes. 204
 * while nothing changed since `v`, which is most polls; 410 once the handoff
 * can't take strokes any more, so the page stops asking.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ token: string; handoffId: string }> },
) {
  const { token, handoffId } = await context.params;
  const { status, share } = await resolveShare(token);
  if (status !== "ok" || !share) return new NextResponse(null, { status: 404 });

  const handoff = await prisma.signatureHandoff.findFirst({
    where: { id: handoffId, quoteId: share.quoteId },
    select: { paths: true, version: true, expiresAt: true },
  });
  if (!handoff) return new NextResponse(null, { status: 404 });

  const headers = { "Cache-Control": "no-store" };
  if (handoffState(handoff, share.quote, true) !== "ok") {
    return new NextResponse(null, { status: 410, headers });
  }

  const since = Number(new URL(request.url).searchParams.get("v") ?? "0");
  if (handoff.version <= since) return new NextResponse(null, { status: 204, headers });

  return NextResponse.json({ paths: handoff.paths, version: handoff.version }, { headers });
}
