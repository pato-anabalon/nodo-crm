import { prisma } from "@/lib/db/prisma";
import { bearerToken, hashToken, sessionExpiry, sessionState, shouldSlide } from "./tokens";

export type MobileSession = { id: string; userId: string };

/**
 * The signed-in phone behind a request, or null.
 *
 * Who the person is, never which company: that comes from the `X-Nodo-Company`
 * header and is checked against membership on every request, by the same
 * `buildCompanyContext` the web goes through.
 */
export async function mobileSessionFrom(request: Request, now: Date = new Date()): Promise<MobileSession | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;

  const session = await prisma.mobileSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true, lastUsedAt: true },
  });
  if (!session || sessionState(session, now) !== "ok") return null;

  if (shouldSlide(session.lastUsedAt, now)) {
    await prisma.mobileSession.update({
      where: { id: session.id },
      data: { lastUsedAt: now, expiresAt: sessionExpiry(now) },
    });
  }
  return { id: session.id, userId: session.userId };
}
