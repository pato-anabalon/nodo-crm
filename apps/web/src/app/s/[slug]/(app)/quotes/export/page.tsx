import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExportForm } from "@/modules/quotes/export-form";
import { quoteYears } from "@/modules/quotes/export-service";

export async function generateMetadata() {
  const t = await getTranslations("quotes.export");
  return { title: t("title") };
}

export default async function ExportQuotesPage() {
  const ctx = await requireCompanyContext();
  const [t, tQuotes] = await Promise.all([getTranslations("quotes.export"), getTranslations("quotes")]);

  if (!can(ctx, "quotes.read") || !can(ctx, "quotes.export")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const years = await quoteYears(ctx);
  const canSeeAmounts = can(ctx, "quotes.read.amounts");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
          <Link href="/quotes" aria-label={t("back", { section: tQuotes("title") })}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          {years.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ExportForm
              years={years}
              labels={{
                year: t("year"),
                yearHint: t("yearHint"),
                download: t("download"),
                preparing: t("preparing"),
                preparingHint: t("preparingHint"),
              }}
            />
          )}

          {!canSeeAmounts ? <p className="text-xs text-muted-foreground">{t("noAmounts")}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
