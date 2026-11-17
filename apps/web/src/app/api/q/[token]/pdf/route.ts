import { NextResponse } from "next/server";
import { languageToLocale } from "@/i18n/config";
import { resolveShare } from "@/modules/portal/service";
import { renderQuotePdfBuffer } from "@/modules/portal/pdf/quote-pdf";
import { formatQuoteNumber } from "@/lib/format";

/**
 * The customer's download button.
 *
 * Builds the PDF straight from the share's own data — the same `company` and
 * `quote` the live page reads — rather than rendering any page at all. That's
 * what let the earlier, Chromium-based version of this route go: without a
 * browser navigating anywhere, there's no heartbeat to accidentally beat and
 * no host header to get right.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) {
    return new NextResponse(null, { status: 404 });
  }

  const pdf = await renderQuotePdfBuffer({
    company: share.company,
    quote: share.quote,
    locale: languageToLocale(share.quote.language),
  });
  const reference = formatQuoteNumber(share.company.quotePrefix, share.quote.number);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reference}.pdf"`,
    },
  });
}
