import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
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
import { clientCompanyFiltersFromParams } from "@/modules/client-companies/schemas";
import { listClientCompanies } from "@/modules/client-companies/service";

export async function generateMetadata() {
  const t = await getTranslations("clients");
  return { title: t("title") };
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompanyContext();
  const [t, tCommon] = await Promise.all([
    getTranslations("clients"),
    getTranslations("common"),
  ]);

  if (!can(ctx, "contacts.read")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const filters = clientCompanyFiltersFromParams(await searchParams);
  const { items, total, page, pageCount } = await listClientCompanies(ctx, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("count", { count: total })}</p>
        </div>

        {can(ctx, "contacts.create") ? (
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="size-4" />
              {t("new")}
            </Link>
          </Button>
        ) : null}
      </div>

      <form className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={filters.q ?? ""} placeholder={t("searchPlaceholder")} className="max-w-xs" />
        <Button type="submit" variant="secondary">{tCommon("search")}</Button>
      </form>

      <TableCard>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.name")}</TableHead>
                  <TableHead>{t("columns.email")}</TableHead>
                  <TableHead>{t("columns.phone")}</TableHead>
                  <TableHead>{t("columns.address")}</TableHead>
                  <TableHead className="text-right">{t("columns.people")}</TableHead>
                  <TableHead className="text-right">{t("columns.leads")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                          {client.name}
                        </Link>
                        {client.taxId ? (
                          <p className="text-xs text-muted-foreground">{client.taxId}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {client.email ?? tCommon("none")}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {client.phone ?? tCommon("none")}
                      </TableCell>
                      {/*
                        The only field here that runs long. It gets the room the
                        row has left and truncates rather than wrapping, because
                        a two-line address would set the height of every row
                        around it. The whole thing is one hover away.
                      */}
                      <TableCell className="max-w-56 text-sm text-muted-foreground">
                        {client.address ? (
                          <span className="block truncate" title={client.address}>
                            {client.address}
                          </span>
                        ) : (
                          tCommon("none")
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{client._count.contacts}</TableCell>
                      <TableCell className="text-right tabular-nums">{client._count.leads}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
      </TableCard>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{tCommon("pageOf", { page, total: pageCount })}</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients?page=${page - 1}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}>
                  {tCommon("previous")}
                </Link>
              </Button>
            ) : null}
            {page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients?page=${page + 1}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}>
                  {tCommon("next")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
