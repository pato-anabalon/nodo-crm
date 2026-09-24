import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireCompanyContext, can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { leadFiltersSchema } from "@/modules/leads/schemas";
import { listLeads } from "@/modules/leads/service";
import { LEAD_PIPELINE, leadStatusVariant } from "@/modules/leads/constants";
import { formatMoney } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("leads");
  return { title: t("title") };
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompanyContext();
  const [t, tCommon] = await Promise.all([
    getTranslations("leads"),
    getTranslations("common"),
  ]);

  if (!can(ctx, "leads.read")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const raw = await searchParams;
  const filters = leadFiltersSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" && raw.status !== "" ? raw.status : undefined,
    discarded: raw.discarded === "1",
    page: typeof raw.page === "string" ? raw.page : 1,
  });

  const { items, total, page, pageCount } = await listLeads(ctx, filters);
  const seesAll = can(ctx, "leads.read.all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {seesAll ? t("countInCompany", { count: total }) : t("countMine", { count: total })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={filters.discarded ? "/leads" : "/leads?discarded=1"}>
              {filters.discarded ? t("showInbox") : t("showDiscarded")}
            </Link>
          </Button>

          {can(ctx, "leads.create") ? (
            <Button asChild>
              <Link href="/leads/new">
                <Plus className="size-4" />
                {t("new")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        {filters.discarded ? <input type="hidden" name="discarded" value="1" /> : null}
        <Input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        <NativeSelect
          name="status"
          defaultValue={filters.status ?? ""}
          className="w-auto"
          placeholder={tCommon("allStatuses")}
          options={LEAD_PIPELINE.map((status) => ({
            value: status,
            label: t(`status.${status}`),
          }))}
        />
        <Button type="submit" variant="secondary">
          {tCommon("filter")}
        </Button>
      </form>

      <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.opportunity")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.owner")}</TableHead>
                <TableHead className="text-right">{t("columns.estimatedValue")}</TableHead>
                <TableHead className="text-right">{t("columns.quotes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    {filters.discarded ? t("emptyDiscarded") : t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {lead.title}
                      </Link>
                      {lead.companyName ? (
                        <p className="text-xs text-muted-foreground">{lead.companyName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={leadStatusVariant(lead.status)}>
                        {t(`status.${lead.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.owner?.name ?? lead.owner?.email ?? tCommon("unassigned")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lead.estimatedValue
                        ? formatMoney(
                            Number(lead.estimatedValue),
                            lead.currency,
                            ctx.company.formatLocale,
                          )
                        : tCommon("none")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{lead._count.quotes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </TableCard>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {tCommon("pageOf", { page, total: pageCount })}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildPageHref(filters, page - 1)}>{tCommon("previous")}</Link>
              </Button>
            ) : null}
            {page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildPageHref(filters, page + 1)}>{tCommon("next")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildPageHref(
  filters: { q?: string; status?: string; discarded?: boolean },
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.discarded) params.set("discarded", "1");
  params.set("page", String(page));
  return `/leads?${params.toString()}`;
}
