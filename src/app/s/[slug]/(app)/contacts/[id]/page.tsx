import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { QUOTE_STATUS_CLASS } from "@/modules/quotes/constants";
import { contactDisplayName } from "@/modules/contacts/identity";
import { deleteContactAction, updateContactAction } from "@/modules/contacts/actions";
import { ContactForm } from "@/modules/contacts/contact-form";
import { getContact } from "@/modules/contacts/service";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCompanyContext();
  const [t, tCommon, tLeads, tQuotes] = await Promise.all([
    getTranslations("contacts"),
    getTranslations("common"),
    getTranslations("leads"),
    getTranslations("quotes"),
  ]);

  if (!can(ctx, "contacts.read")) notFound();

  const contact = await getContact(ctx, id);
  if (!contact) notFound();

  const money = (value: number, currency: string) =>
    formatMoney(value, currency, ctx.company.formatLocale);
  const date = (value: Date) => formatDate(value, ctx.company.formatLocale, ctx.company.timezone);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/contacts" aria-label={t("title")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contactDisplayName(contact)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[contact.position, contact.clientCompany?.name].filter(Boolean).join(" · ") ||
                t("noAccount")}
            </p>
          </div>
        </div>

        {can(ctx, "contacts.delete") ? (
          <form action={deleteContactAction.bind(null, contact.id)}>
            <Button type="submit" variant="ghost" size="sm">
              <Trash2 className="size-4" />
              {t("delete")}
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {can(ctx, "contacts.update") ? (
            <ContactForm
              action={updateContactAction.bind(null, contact.id)}
              defaults={{
                firstName: contact.firstName,
                lastName: contact.lastName,
                email: contact.email,
                phone: contact.phone,
                position: contact.position,
                clientCompanyName: contact.clientCompany?.name ?? null,
              }}
              submitLabel={tCommon("saveChanges")}
            />
          ) : null}
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("history.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("history.subtitle")}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {contact.leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
              ) : (
                contact.leads.map((lead) => (
                  <div key={lead.id} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {lead.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{date(lead.createdAt)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{tLeads(`status.${lead.status}`)}</Badge>
                      {lead.discardedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {tLeads("discarded")}
                        </span>
                      ) : null}
                    </div>

                    {lead.quotes.length > 0 ? (
                      <ul className="space-y-1.5">
                        {lead.quotes.map((quote) => (
                          <li
                            key={quote.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <Link href={`/quotes/${quote.id}`} className="hover:underline">
                              <span className="font-mono text-xs text-muted-foreground">
                                {formatQuoteNumber(ctx.company.quotePrefix, quote.number)}
                              </span>{" "}
                              {quote.title}
                            </Link>
                            <span className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={QUOTE_STATUS_CLASS[quote.status]}
                              >
                                {tQuotes(`status.${quote.status}`)}
                              </Badge>
                              <span className="tabular-nums">
                                {money(Number(quote.total), quote.currency)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
