import { NextResponse } from "next/server";
import { resolveHandoff, saveHandoffStrokes } from "@/modules/portal/handoff";
import { isSignaturePath } from "@/modules/portal/signature";

/** The same cap the acceptance puts on `signatureData`. */
const MAX_BYTES = 200_000;

/**
 * The phone sending its strokes, every time a finger lifts.
 *
 * All of them each time, replacing the last send: a retry changes nothing and
 * "Clear" is just an empty send. The token is the QR's own and only lets
 * strokes in — there is nothing here to read back.
 *
 * Answers carry no detail about why a token didn't work beyond what the phone
 * needs to tell its user, so a guessed token learns nothing.
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return new NextResponse(null, { status: 413 });

  let paths: unknown;
  try {
    paths = (JSON.parse(raw) as { paths?: unknown }).paths;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (typeof paths !== "string" || !isSignaturePath(paths)) {
    return new NextResponse(null, { status: 400 });
  }

  const { state, handoff } = await resolveHandoff(token);
  if (state === "not-found" || !handoff) return new NextResponse(null, { status: 404 });
  // Expired or closed: the phone says so and stops; nothing is written.
  if (state !== "ok") return new NextResponse(null, { status: 410 });

  await saveHandoffStrokes(handoff.id, {
    paths,
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return new NextResponse(null, { status: 204 });
}
