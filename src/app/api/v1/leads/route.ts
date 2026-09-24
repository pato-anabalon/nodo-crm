import { after, NextResponse, type NextRequest } from "next/server";
import { IngestOutcome } from "@/generated/prisma/enums";
import { readToken } from "@/modules/ingest/keys";
import { corsHeaders, normalizeOrigin } from "@/modules/ingest/origins";
import { MAX_BODY_BYTES, clientIp } from "@/modules/ingest/limits";
import { isHoneypotFilled } from "@/modules/ingest/payload";
import { notifyLeadReceived } from "@/modules/notifications/service";
import {
  authenticateKey,
  companyIngestDefaults,
  createLeadFromSubmission,
  enforceRateLimit,
  recordAttempt,
} from "@/modules/ingest/service";

/**
 * Lead intake from companies' website forms.
 *
 * It lives on the root domain rather than each company's subdomain: the key
 * already identifies who the lead belongs to, so the snippet handed to every
 * customer is identical except for their token.
 *
 *   POST /api/v1/leads
 *   Authorization: Bearer nodo_pk_…      (or X-Api-Key)
 *   Idempotency-Key: <optional>
 *   { "name": "...", "email": "...", ... }
 *
 * Rejections are deliberately opaque: it's never confirmed whether a token exists.
 */

/** Generic rejection response. Gives away no cause to the outside. */
function refuse(status: number, message: string, origin: string | null) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(request: NextRequest) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  // The preflight can't validate the key (the browser sends no custom headers
  // there), so it answers permissively and the POST does the real checking.
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent");

  const auth = await authenticateKey(readToken(request.headers), origin);
  if (!auth.ok) {
    await recordAttempt({ outcome: auth.outcome, origin, ipAddress: ip, detail: auth.detail });
    return refuse(401, "Unauthorized", origin);
  }

  const { key } = auth;
  const attempt = (outcome: IngestOutcome, detail?: string) =>
    recordAttempt({
      companyId: key.companyId,
      ingestKeyId: key.id,
      outcome,
      origin,
      ipAddress: ip,
      detail,
    });

  const rate = await enforceRateLimit(key.id, key.companyId, ip);
  if (rate.limited) {
    await attempt(IngestOutcome.RATE_LIMITED, `Límite alcanzado por ${rate.scope}`);
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...corsHeaders(origin), "Retry-After": "3600" } },
    );
  }

  // The body is measured before parsing: a giant JSON shouldn't get as far as
  // taking up memory or being written to the database.
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    await attempt(IngestOutcome.PAYLOAD_TOO_LARGE);
    return refuse(413, "Payload too large", origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = parseBody(raw, request.headers.get("content-type"));
  } catch {
    await attempt(IngestOutcome.INVALID_PAYLOAD, "The body is neither JSON nor a valid form");
    return refuse(400, "Invalid payload", origin);
  }

  if (Object.keys(payload).length === 0) {
    await attempt(IngestOutcome.INVALID_PAYLOAD, "Empty form");
    return refuse(400, "Invalid payload", origin);
  }

  // Honeypot filled: answer 202 as if all went well, so the bot doesn't learn it
  // was spotted.
  if (isHoneypotFilled(payload)) {
    await attempt(IngestOutcome.HONEYPOT);
    return NextResponse.json({ status: "accepted" }, { status: 202, headers: corsHeaders(origin) });
  }

  const company = await companyIngestDefaults(key.companyId);

  const result = await createLeadFromSubmission({
    key,
    payload,
    idempotencyKey: request.headers.get("idempotency-key"),
    ipAddress: ip,
    userAgent,
    fallbackTitle: "Website enquiry",
    currency: company.currency,
  });

  await attempt(result.duplicate ? IngestOutcome.DUPLICATE : IngestOutcome.ACCEPTED);

  // Notifying the team must not keep the customer's form waiting.
  if (!result.duplicate) after(() => notifyLeadReceived(result.leadId));

  return NextResponse.json(
    { status: "accepted", id: result.leadId, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 201, headers: corsHeaders(origin) },
  );
}

/** Accepts JSON and `application/x-www-form-urlencoded`, which is what an HTML form posts. */
function parseBody(raw: string, contentType: string | null): Record<string, unknown> {
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const result: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      // A repeated field (checkboxes) accumulates into a list.
      const existing = result[key];
      if (existing === undefined) result[key] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else result[key] = [existing, value];
    }
    return result;
  }

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("El cuerpo debe ser un objeto");
  }
  return parsed as Record<string, unknown>;
}
