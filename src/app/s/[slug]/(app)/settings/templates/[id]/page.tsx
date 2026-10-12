import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichText } from "@/components/rich-text";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PricingMode } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/format";
import { getQuoteTemplate } from "@/modules/quote-templates/service";
import { HiddenAmount } from "@/modules/quotes/hidden-amount";
import { lineTotal } from "@/modules/quotes/totals";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("settings.read");
  const template = await getQuoteTemplate(ctx, id);
  const t = await getTranslations("quoteTemplates");
  return { title: template?.name ?? t("title") };
}

/**
 * A template, read back.
 *
 * Read-only on purpose: the content comes from a real quote and is changed by
 * saving a new one, which keeps this from becoming a second quote editor. What
 * it does have to answer is what picking the template will put in the form —
 * so the texts it doesn't carry say where they come from instead (the
 * company's own, which is what `quotes/new` falls back to).
 */
export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("settings.read");
  const [t, tQuotes] = await Promise.all([
    getTranslations("quoteTemplates"),
    getTranslations("quotes"),
  ]);

  const template = await getQuoteTemplate(ctx, id);
  if (!template) notFound();

  // A template has no currency of its own: a quote started from it begins in
  // the company's, so that's what the figures read in.
  const canSeeAmounts = can(ctx, "quotes.read.amounts");
  const money = (amount: number) =>
    canSeeAmounts ? formatMoney(amount, ctx.company.currency, ctx.company.formatLocale) : <HiddenAmount />;

  const bySections = template.pricingMode === PricingMode.SECTIONS;
  const texts = [
    { label: tQuotes("form.intro"), html: template.intro },
    { label: tQuotes("form.scope"), html: template.scope },
    { label: tQuotes("form.notes"), html: template.notes },
    { label: tQuotes("form.exclusions"), html: template.exclusions },
    { label: tQuotes("form.terms"), html: template.terms },
  ];

  return (
    <div className="space-y-6">
      {/* Back to the list, not to the index: this screen hangs off that one. */}
      <SettingsHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {template.name}
            {!template.active ? <Badge variant="secondary">{t("retiredBadge")}</Badge> : null}
          </span>
        }
        subtitle={template.description ?? t("detail.subtitle")}
        back={{ href: "/settings/templates", label: t("title") }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("detail.readOnly")}</p>
        {template.active && can(ctx, "quotes.create") ? (
          <Button asChild size="sm">
            <Link href={`/quotes/new?template=${template.id}`}>{t("detail.use")}</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-x-8 gap-y-3 pt-6 text-sm">
          <Field label={t("detail.suggestedTitle")} value={template.titlePattern ?? template.name} />
          <Field
            label={tQuotes("form.pricingMode.label")}
            value={tQuotes(`form.pricingMode.${template.pricingMode}`)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {bySections ? tQuotes("form.sections") : tQuotes("form.lines")}
          </CardTitle>
        </CardHeader>

        {bySections ? (
          <CardContent className="space-y-5">
            {template.sections.length === 0 ? <Empty>{t("detail.noContent")}</Empty> : null}
            {template.sections.map((section) => (
              <div key={section.id} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-semibold">{section.title}</h3>
                  <span className="tabular-nums">{money(Number(section.amount))}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tQuotes(`form.sectionKind.${section.kind}`)}
                </p>
                <RichText className="text-sm text-muted-foreground" html={section.body} />
              </div>
            ))}
          </CardContent>
        ) : template.items.length === 0 ? (
          <CardContent>
            <Empty>{t("detail.noContent")}</Empty>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tQuotes("columns.description")}</TableHead>
                  <TableHead className="text-right">{tQuotes("columns.quantity")}</TableHead>
                  <TableHead className="text-right">{tQuotes("columns.unitPrice")}</TableHead>
                  <TableHead className="text-right">{tQuotes("columns.discount")}</TableHead>
                  <TableHead className="text-right">{tQuotes("columns.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {template.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(item.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(Number(item.unitPrice))}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(item.discount)}%</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(
                        lineTotal({
                          quantity: Number(item.quantity),
                          unitPrice: Number(item.unitPrice),
                          discount: Number(item.discount),
                        }),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.texts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {texts.map((text) => (
            <div key={text.label} className="space-y-1.5">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {text.label}
              </h3>
              {text.html ? (
                <RichText html={text.html} />
              ) : (
                <Empty>{t("detail.companyDefault")}</Empty>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="break-words">{value}</p>
    </div>
  );
}

/** Empty reads as a fact, not a fault — same quiet italic as the settings index. */
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>;
}
