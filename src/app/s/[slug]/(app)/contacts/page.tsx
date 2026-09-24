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
import { contactDisplayName } from "@/modules/contacts/identity";
import { contactFiltersFromParams } from "@/modules/contacts/schemas";
import { listContacts } from "@/modules/contacts/service";

export async function generateMetadata() {
  const t = await getTranslations("contacts");
  return { title: t("title") };
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompanyContext();
  const [t, tCommon] = await Promise.all([
    getTranslations("contacts"),
    getTranslations("common"),
  ]);

  if (!can(ctx, "contacts.read")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const filters = contactFiltersFromParams(await searchParams);
  const { items, total, page, pageCount } = await listContacts(ctx, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("count", { count: total })}</p>
        </div>

        {can(ctx, "contacts.create") ? (
          <Button asChild>
            <Link href="/contacts/new">
              <Plus className="size-4" />
              {t("new")}
            </Link>
          </Button>
        ) : null}
      </div>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary">
          {tCommon("search")}
        </Button>
      </form>

      <TableCard>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.name")}</TableHead>
                  <TableHead>{t("columns.email")}</TableHead>
                  <TableHead>{t("columns.phone")}</TableHead>
                  <TableHead>{t("columns.account")}</TableHead>
                  <TableHead className="text-right">{t("columns.leads")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline">
                          {contactDisplayName(contact)}
                        </Link>
                        {contact.position ? (
                          <p className="text-xs text-muted-foreground">{contact.position}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.email ?? tCommon("none")}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {contact.phone ?? tCommon("none")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.clientCompany?.name ?? tCommon("none")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {contact._count.leads}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
      </TableCard>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {tCommon("pageOf", { page, total: pageCount })}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/contacts?page=${page - 1}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}>
                  {tCommon("previous")}
                </Link>
              </Button>
            ) : null}
            {page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/contacts?page=${page + 1}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}>
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
