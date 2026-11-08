import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import type { Permission } from "@nodo/core/auth/permissions";
import { buildCompanyContext, can, ForbiddenError, type CompanyContext } from "@/lib/auth/session";
import { JobClosedError } from "@/modules/jobs/closing";
import { mobileSessionFrom, type MobileSession } from "./session";

/**
 * Every route the app calls goes through one of these three, and a test reads
 * `app/api/m` to make sure none is written by hand. They answer the questions
 * a page answers with a redirect or a 404 page — who is this, in which company,
 * may they — with a status code and a JSON body the app can act on.
 *
 * Errors are **codes, never sentences**: `{ error: "invalid_credentials" }`,
 * and field errors as the same message keys the web's schemas emit. The app has
 * the same messages package and translates them in the person's language; the
 * server often doesn't know that language yet (signing in) and shouldn't guess.
 */

export const COMPANY_HEADER = "x-nodo-company";

/** A refusal the app is expected to handle: status, a code, and anything that helps. */
export class MobileError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "MobileError";
  }
}

export const notFound = () => new MobileError(404, "not_found");

type Params = Record<string, string | string[]>;
type RouteContext = { params: Promise<Params> };
type Handler = (request: Request, route: RouteContext) => Promise<Response>;

type Options<Body, Extra> = {
  body?: ZodType<Body>;
  handler: (args: Extra & { body: Body; request: Request; params: Params }) => Promise<unknown>;
};

/** No sign-in: the doors in (password, code). */
export function mobilePublicRoute<Body = undefined>(options: Options<Body, object>): Handler {
  return wrap(async (request, params) => {
    const body = await readBody(request, options.body);
    return options.handler({ body, request, params });
  });
}

/** Signed in, no company yet: choosing one, signing out. */
export function mobileUserRoute<Body = undefined>(options: Options<Body, { session: MobileSession }>): Handler {
  return wrap(async (request, params) => {
    const session = await requireSession(request);
    const body = await readBody(request, options.body);
    return options.handler({ session, body, request, params });
  });
}

/** Signed in and working in a company — everything else. */
export function mobileRoute<Body = undefined>(
  options: Options<Body, { session: MobileSession; ctx: CompanyContext }> & { permission?: Permission },
): Handler {
  return wrap(async (request, params) => {
    const session = await requireSession(request);
    const slug = request.headers.get(COMPANY_HEADER)?.trim().toLowerCase();
    if (!slug) throw new MobileError(400, "company_required");

    const ctx = await buildCompanyContext(session.userId, slug);
    // Not a member, suspended, or a company that is off: the same answer for all
    // three, as on the web, so it can't be used to find out which names exist.
    if (!ctx) throw new MobileError(403, "no_access");
    if (options.permission && !can(ctx, options.permission)) throw new ForbiddenError(options.permission);

    const body = await readBody(request, options.body);
    return options.handler({ session, ctx, body, request, params });
  });
}

async function requireSession(request: Request): Promise<MobileSession> {
  const session = await mobileSessionFrom(request);
  if (!session) throw new MobileError(401, "unauthenticated");
  return session;
}

async function readBody<Body>(request: Request, schema: ZodType<Body> | undefined): Promise<Body> {
  if (!schema) return undefined as Body;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new MobileError(400, "invalid_json");
  }
  return validate(schema, raw);
}

/** Parses with a schema, or refuses with 422 and the fields' message keys — for values a handler builds itself. */
export function validate<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new MobileError(422, "invalid", { fields: fieldErrors(parsed.error) });
  }
  return parsed.data;
}

/**
 * A schema's own messages are keys (`validation.invalidEmail`); zod's defaults
 * are English sentences, and a field without a message of its own is a bug in
 * the app rather than something to show the person. Those become one key.
 */
// `validation.required`, or a module's own (`jobs.validation.endBeforeStart`).
const MESSAGE_KEY = /^(\w+\.)*validation\.\w+$/;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(z.flattenError(error).fieldErrors)) {
    fields[field] = (messages as string[]).map((message) => (MESSAGE_KEY.test(message) ? message : "validation.invalid"));
  }
  return fields;
}

function wrap(run: (request: Request, params: Params) => Promise<unknown>): Handler {
  return async (request, route) => {
    try {
      const result = await run(request, (await route?.params) ?? {});
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof MobileError) {
    return NextResponse.json({ error: error.code, ...error.extra }, { status: error.status });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "forbidden", permission: error.permission }, { status: 403 });
  }
  if (error instanceof JobClosedError) {
    return NextResponse.json({ error: "job_closed" }, { status: 409 });
  }
  console.error("Mobile API error", error);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}
