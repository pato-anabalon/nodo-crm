import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/session";
import { getQuoteDocument } from "@/modules/quotes/service";
import { renderQuotePdfBuffer } from "@/modules/portal/pdf/quote-pdf";
import { languageToLocale } from "@/i18n/config";
import { formatQuoteNumber } from "@/lib/format";

/**
 * The team's own download button, from "view as customer".
 *
 * Builds the PDF from the same data the preview page reads, through the
 * session already on this request — no page to render and so no cookie to
 * forward to anything.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getCompanyContext();
  if (!ctx || !ctx.permissions.has("quotes.read")) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await context.params;
  const document = await getQuoteDocument(ctx, id);
  if (!document) return new NextResponse(null, { status: 404 });

  const pdf = await renderQuotePdfBuffer({
    company: document.company,
    quote: document.quote,
    locale: languageToLocale(document.quote.language),
  });
  const reference = formatQuoteNumber(ctx.company.quotePrefix, document.quote.number);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reference}.pdf"`,
    },
  });
}
