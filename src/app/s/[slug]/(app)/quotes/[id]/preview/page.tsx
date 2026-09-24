import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { languageToLocale } from "@/i18n/config";
import { getQuoteDocument } from "@/modules/quotes/service";
import { QuoteDocument } from "@/modules/portal/quote-document";

/**
 * The quote as the customer sees it, for the team's own eyes.
 *
 * Deliberately not the customer's link: opening that one would beat presence,
 * count as an opening and email "your quote was opened" — the company would end
 * up watching itself. This route reads the same data through the session and
 * renders the same document with nothing live attached.
 */
export default async function QuotePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireCompanyContext();

  if (!can(ctx, "quotes.read")) notFound();

  const document = await getQuoteDocument(ctx, id);
  if (!document) notFound();

  const t = await getTranslations("quotes.share");
  const locale = languageToLocale(document.quote.language);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/quotes/${id}`} aria-label={t("title")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">{t("previewHint")}</p>
      </div>

      <div className="rounded-lg border bg-background">
        <QuoteDocument
          company={document.company}
          quote={document.quote}
          locale={locale}
          token={null}
        />
      </div>
    </div>
  );
}
