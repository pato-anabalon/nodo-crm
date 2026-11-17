import QRCode from "qrcode";
import type { Language } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { companyUrl } from "@/lib/tenant/host";
import { generateShareToken, hashShareToken, shareStatus } from "./share";
import { HANDOFF_MINUTES, handoffState, type HandoffState } from "./signature";

/**
 * Signing on a phone for a quote open on a computer.
 *
 * No session on either side, so everything goes through `prisma` with the
 * ids the two tokens resolve to — the same shape as the rest of the portal.
 */

/**
 * Opens a handoff and draws its QR.
 *
 * The QR carries a token of its own, never the quote's link: whoever scans it
 * can draw and nothing else. Expired handoffs of the same quote are swept
 * here, so the table holds only the few minutes that matter.
 */
export async function startHandoff(input: {
  companyId: string;
  companySlug: string;
  quoteId: string;
  recipientId: string | null;
}): Promise<{ id: string; qrSvg: string }> {
  const { token, hashedToken } = generateShareToken();
  const now = new Date();

  await prisma.signatureHandoff.deleteMany({
    where: { quoteId: input.quoteId, expiresAt: { lt: now } },
  });

  const handoff = await prisma.signatureHandoff.create({
    data: {
      companyId: input.companyId,
      quoteId: input.quoteId,
      recipientId: input.recipientId,
      hashedToken,
      expiresAt: new Date(now.getTime() + HANDOFF_MINUTES * 60 * 1000),
    },
    select: { id: true },
  });

  const url = companyUrl(input.companySlug, `/sign/${token}`);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return { id: handoff.id, qrSvg };
}

/** What the phone's page and its endpoint need, from the token in the QR. */
export async function resolveHandoff(token: string): Promise<{
  state: HandoffState | "not-found";
  handoff: {
    id: string;
    paths: string;
    language: Language;
    company: { slug: string; name: string; logoUrl: string | null };
  } | null;
}> {
  if (!token || token.length < 20) return { state: "not-found", handoff: null };

  const found = await prisma.signatureHandoff.findUnique({
    where: { hashedToken: hashShareToken(token) },
    select: {
      id: true,
      paths: true,
      expiresAt: true,
      company: { select: { slug: true, name: true, logoUrl: true } },
      quote: {
        select: {
          status: true,
          language: true,
          share: { select: { revokedAt: true, expiresAt: true } },
        },
      },
    },
  });
  if (!found) return { state: "not-found", handoff: null };

  const state = handoffState(found, found.quote, shareStatus(found.quote.share) === "ok");
  return {
    state,
    handoff: {
      id: found.id,
      paths: found.paths,
      language: found.quote.language,
      company: found.company,
    },
  };
}

/** The phone's strokes, replacing the last ones. Each send is a new version. */
export async function saveHandoffStrokes(
  id: string,
  input: { paths: string; userAgent: string | null; ipAddress: string | null },
): Promise<void> {
  await prisma.signatureHandoff.update({
    where: { id },
    data: {
      paths: input.paths,
      version: { increment: 1 },
      deviceUserAgent: input.userAgent,
      deviceIp: input.ipAddress,
    },
  });
}
