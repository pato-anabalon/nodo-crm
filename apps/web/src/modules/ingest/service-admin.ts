import type { CompanyContext } from "@/lib/auth/session";
import { IngestKeyType, IngestOutcome } from "@/generated/prisma/enums";

/** The company's keys, never exposing the hash or the token. */
export async function listIngestKeys(ctx: CompanyContext) {
  return ctx.db.ingestKey.findMany({
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      prefix: true,
      allowedOrigins: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      _count: { select: { submissions: true } },
    },
  });
}

/**
 * Latest rejections, so the company can diagnose on its own why its form isn't
 * getting through. Accepted ones aren't listed: those already show up as leads.
 */
export async function listRecentRejections(ctx: CompanyContext, take = 10) {
  return ctx.db.ingestAttempt.findMany({
    where: { outcome: { not: IngestOutcome.ACCEPTED } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      outcome: true,
      origin: true,
      detail: true,
      createdAt: true,
      ingestKey: { select: { name: true } },
    },
  });
}

export function needsAllowedOrigins(type: IngestKeyType): boolean {
  return type === IngestKeyType.PUBLIC;
}
