import { NextResponse, type NextRequest } from "next/server";
import { companySlugFromHost } from "@/lib/tenant/host";

/**
 * Subdomain routing.
 *
 * `acme.nodo-crm.app/leads` is rewritten internally to `/s/acme/leads`, so the
 * route tree can have a layout of its own per company. The URL the user sees
 * doesn't change. The root domain serves the public site as is.
 *
 * In Next 16 this piece is called `proxy` (formerly `middleware`).
 */
export default function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const slug = companySlugFromHost(host);

  if (!slug) return NextResponse.next();

  const url = request.nextUrl.clone();

  // Avoids rewriting twice when the path already came resolved.
  if (url.pathname.startsWith(`/s/${slug}`)) return NextResponse.next();

  url.pathname = `/s/${slug}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Everything except:
     * - /api (includes the Auth.js routes, which must keep their path)
     * - /_next (build assets)
     * - files with an extension (favicon, images, etc.)
     */
    "/((?!api/|_next/|.*\\..*).*)",
  ],
};
