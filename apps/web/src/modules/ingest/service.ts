import { prisma } from "@/lib/db/prisma";
import { attachContact } from "@/modules/contacts/attach";
import { attachClientCompany } from "@/modules/client-companies/attach";
import { ActivityType, IngestOutcome, IngestKeyType, LeadStatus } from "@/generated/prisma/enums";
import { hashIngestKey, keyTypeFromToken } from "./keys";
import { isOriginAllowed } from "./origins";
import { checkRate, windowStart } from "./limits";
import { buildLeadTitle, normalizeSubmission } from "./payload";
import { extractAttachments } from "./attachments";
import { resolveIngestSource } from "./source";

export type AuthResult =
  | { ok: true; key: AuthenticatedKey }
  | { ok: false; outcome: IngestOutcome; detail?: string };

export type AuthenticatedKey = {
  id: string;
  companyId: string;
  type: IngestKeyType;
  allowedOrigins: string[];
};

/**
 * Resolves the request's key.
 *
 * Every rejection is equally opaque from the outside: it's never confirmed
 * whether a token exists, is revoked, or belongs to another company.
 */
export async function authenticateKey(
  token: string | null,
  origin: string | null,
): Promise<AuthResult> {
  if (!token || !keyTypeFromToken(token)) {
    return { ok: false, outcome: IngestOutcome.INVALID_KEY, detail: "Token ausente o con formato desconocido" };
  }

  const key = await prisma.ingestKey.findUnique({
    where: { hashedSecret: hashIngestKey(token) },
    select: {
      id: true,
      companyId: true,
      type: true,
      allowedOrigins: true,
      revokedAt: true,
      company: { select: { isActive: true } },
    },
  });

  if (!key) {
    return { ok: false, outcome: IngestOutcome.INVALID_KEY, detail: "Token no reconocido" };
  }
  // A suspended company reads the same as a revoked key from the outside: the
  // rejection stays opaque either way, so this isn't a new outcome of its own.
  if (key.revokedAt || !key.company.isActive) {
    return {
      ok: false,
      outcome: IngestOutcome.REVOKED_KEY,
      detail: "La clave fue revocada",
    };
  }

  // A public key travels in the site's HTML, so the domain list is the only
  // thing stopping it being used from somewhere else.
  if (key.type === IngestKeyType.PUBLIC && !isOriginAllowed(key.allowedOrigins, origin)) {
    return {
      ok: false,
      outcome: IngestOutcome.ORIGIN_NOT_ALLOWED,
      detail: origin
        ? `El origen ${origin} no está en la lista de la clave`
        : "Una clave pública exige cabecera Origin; para servidor a servidor usa una clave secreta",
    };
  }

  return { ok: true, key };
}

export async function enforceRateLimit(
  keyId: string,
  companyId: string,
  ip: string | null,
) {
  const since = windowStart();

  const [byKey, byIp] = await Promise.all([
    prisma.ingestAttempt.count({ where: { ingestKeyId: keyId, createdAt: { gte: since } } }),
    // Scoped to the company: a shared IP must not block unrelated companies
    // against each other.
    ip
      ? prisma.ingestAttempt.count({
          where: {
            ipAddress: ip,
            companyId,
            outcome: IngestOutcome.ACCEPTED,
            createdAt: { gte: since },
          },
        })
      : Promise.resolve(0),
  ]);

  return checkRate({ byKey, byIp });
}

export async function recordAttempt(input: {
  companyId?: string | null;
  ingestKeyId?: string | null;
  outcome: IngestOutcome;
  origin?: string | null;
  ipAddress?: string | null;
  detail?: string | null;
}) {
  return prisma.ingestAttempt.create({
    data: {
      companyId: input.companyId ?? null,
      ingestKeyId: input.ingestKeyId ?? null,
      outcome: input.outcome,
      origin: input.origin ?? null,
      ipAddress: input.ipAddress ?? null,
      detail: input.detail ?? null,
    },
  });
}

export type IngestedLead = {
  leadId: string;
  duplicate: boolean;
  /** Files waiting to be copied into our store. */
  pendingAttachments: number;
  /** Why some listed files were left out, for the attempt log. */
  rejectedAttachments: string[];
};

/**
 * Creates the lead and its submission in one transaction.
 *
 * The submission stores the full payload untouched; the lead is what the team
 * will edit afterwards.
 */
export async function createLeadFromSubmission(input: {
  key: AuthenticatedKey;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  fallbackTitle: string;
  currency: string;
}): Promise<IngestedLead> {
  const { key, payload, idempotencyKey } = input;

  // A double click on the form must not produce two leads.
  if (idempotencyKey) {
    const existing = await prisma.leadSubmission.findFirst({
      where: { companyId: key.companyId, idempotencyKey },
      select: { leadId: true },
    });
    if (existing) {
      return { leadId: existing.leadId, duplicate: true, pendingAttachments: 0, rejectedAttachments: [] };
    }
  }

  const data = normalizeSubmission(payload);
  const attachments = extractAttachments(payload);
  // Explicit `companyId`: this path has no session to bound it, same as the rest.
  const offered = data.leadSource
    ? (
        await prisma.leadSourceOption.findMany({
          where: { companyId: key.companyId },
          select: { label: true },
        })
      ).map((option) => option.label)
    : [];
  const { source, sourceDetail } = resolveIngestSource(data.leadSource, offered);

  const lead = await prisma.$transaction(async (tx) => {
    // Who this came from, before the lead exists: a returning customer lands on
    // the records they already have instead of a second set.
    const clientCompanyId = await attachClientCompany(tx, key.companyId, data.companyName);
    const contactId = await attachContact(
      tx,
      key.companyId,
      { contactName: data.name, contactEmail: data.email, contactPhone: data.phone },
      clientCompanyId,
    );

    const created = await tx.lead.create({
      data: {
        companyId: key.companyId,
        title: buildLeadTitle(data, input.fallbackTitle),
        description: data.message,
        status: LeadStatus.NEW,
        source,
        sourceDetail,
        currency: input.currency,
        contactId,
        clientCompanyId,
        contactName: data.name,
        contactEmail: data.email,
        contactPhone: data.phone,
        companyName: data.companyName,
      },
    });

    await tx.leadSubmission.create({
      data: {
        companyId: key.companyId,
        leadId: created.id,
        payload: payload as never,
        name: data.name,
        email: data.email,
        phone: data.phone,
        companyName: data.companyName,
        message: data.message,
        serviceType: data.serviceType,
        address: data.address,
        sourceUrl: data.sourceUrl,
        referrer: data.referrer,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        ingestKeyId: key.id,
        idempotencyKey,
      },
    });

    // Recorded as pending: the copy happens after the response, so a slow file
    // host never keeps the customer's form waiting.
    if (attachments.accepted.length > 0) {
      await tx.leadAttachment.createMany({
        data: attachments.accepted.map((file, position) => ({
          companyId: key.companyId,
          leadId: created.id,
          name: file.name,
          contentType: file.contentType,
          size: file.size,
          sourceUrl: file.sourceUrl,
          position,
        })),
      });
    }

    await tx.activity.create({
      data: {
        companyId: key.companyId,
        leadId: created.id,
        type: ActivityType.RECEIVED,
        content: "",
      },
    });

    return created;
  });

  await prisma.ingestKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    leadId: lead.id,
    duplicate: false,
    pendingAttachments: attachments.accepted.length,
    rejectedAttachments: attachments.rejected,
  };
}

export async function companyIngestDefaults(companyId: string) {
  return prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { currency: true, name: true },
  });
}
