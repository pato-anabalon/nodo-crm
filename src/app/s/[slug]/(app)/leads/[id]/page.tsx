import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLead } from "@/modules/leads/service";
import { listCompanyMembers } from "@/modules/team/service";
import { LeadForm } from "@/modules/leads/lead-form";
import { LeadNoteForm } from "@/modules/leads/lead-notes";
import { LeadActionsBar } from "@/modules/leads/lead-actions-bar";
import { LeadActivityLog } from "@/modules/leads/lead-activity-log";
import { LeadSubmissionPanel } from "@/modules/leads/lead-submission";
import {
  addLeadNoteAction,
  assignLeadAction,
  discardLeadAction,
  restoreLeadAction,
  updateLeadAction,
} from "@/modules/leads/actions";
import { leadStatusVariant } from "@/modules/leads/constants";
import { QUOTE_STATUS_CLASS } from "@/modules/quotes/constants";
import { formatMoney, formatQuoteNumber } from "@/lib/format";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCompanyContext();
  const [t, tQuotes, tCommon] = await Promise.all([
    getTranslations("leads"),
    getTranslations("quotes"),
    getTranslations("common"),
  ]);

  if (!can(ctx, "leads.read")) notFound();

  const lead = await getLead(ctx, id);
  if (!lead) notFound();

  const discarded = lead.discardedAt !== null;
  const canEdit = can(ctx, "leads.update") && !discarded;
  const canAssign = can(ctx, "leads.assign");
  const members = canAssign ? await listCompanyMembers(ctx) : [];

  const updateAction = updateLeadAction.bind(null, lead.id);
  const noteAction = addLeadNoteAction.bind(null, lead.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/leads" aria-label={t("backToLeads")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {discarded ? (
                <Badge variant="destructive">{t("discarded")}</Badge>
              ) : (
                <Badge variant={leadStatusVariant(lead.status)}>{t(`status.${lead.status}`)}</Badge>
              )}
              <span>{t(`source.${lead.source}`)}</span>
              {lead.companyName ? <span>· {lead.companyName}</span> : null}
              <span>
                · {t("columns.owner")}: {lead.owner?.name ?? lead.owner?.email ?? tCommon("unassigned")}
              </span>
            </div>
            {discarded && lead.discardedBy ? (
              <p className="text-xs text-muted-foreground">
                {t("discardedBy", {
                  name: lead.discardedBy.name ?? lead.discardedBy.email,
                })}
                {lead.discardReason ? ` — ${lead.discardReason}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LeadActionsBar
            ownerId={lead.ownerId}
            discarded={discarded}
            members={members}
            canAssign={canAssign}
            canDiscard={can(ctx, "leads.update")}
            onAssign={async (ownerId) => {
              "use server";
              return assignLeadAction(lead.id, ownerId);
            }}
            onDiscard={async (formData) => {
              "use server";
              return discardLeadAction(lead.id, {}, formData);
            }}
            onRestore={async () => {
              "use server";
              return restoreLeadAction(lead.id);
            }}
          />

          {can(ctx, "quotes.create") && !discarded ? (
            <Button asChild>
              <Link href={`/quotes/new?leadId=${lead.id}`}>
                <FilePlus2 className="size-4" />
                {t("actions.convert")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue={lead.submission ? "submission" : canEdit ? "detail" : "log"}>
        <TabsList>
          {lead.submission ? (
            <TabsTrigger value="submission">{t("submission.title")}</TabsTrigger>
          ) : null}
          {canEdit ? <TabsTrigger value="detail">{t("tabs.detail")}</TabsTrigger> : null}
          <TabsTrigger value="log">{t("tabs.log")}</TabsTrigger>
          <TabsTrigger value="quotes">
            {t("tabs.quotes", { count: lead.quotes.length })}
          </TabsTrigger>
        </TabsList>

        {lead.submission ? (
          <TabsContent value="submission" className="mt-6">
            <LeadSubmissionPanel
              submission={lead.submission}
              formatLocale={ctx.company.formatLocale}
              timezone={ctx.company.timezone}
            />
          </TabsContent>
        ) : null}

        {canEdit ? (
          <TabsContent value="detail" className="mt-6">
            <LeadForm
              action={updateAction}
              members={members}
              canAssign={canAssign}
              submitLabel={tCommon("saveChanges")}
              currency={ctx.company.currency}
              defaults={{
                title: lead.title,
                description: lead.description,
                status: lead.status,
                source: lead.source,
                score: lead.score,
                estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
                contactName: lead.contactName,
                contactEmail: lead.contactEmail,
                contactPhone: lead.contactPhone,
                companyName: lead.companyName,
                ownerId: lead.ownerId,
                lostReason: lead.lostReason,
              }}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="log" className="mt-6 space-y-6">
          {canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("notes.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadNoteForm action={noteAction} />
              </CardContent>
            </Card>
          ) : null}

          <LeadActivityLog
            activities={lead.activities}
            formatLocale={ctx.company.formatLocale}
            timezone={ctx.company.timezone}
          />
        </TabsContent>

        <TabsContent value="quotes" className="mt-6">
          {lead.quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noQuotes")}</p>
          ) : (
            <ul className="space-y-2">
              {lead.quotes.map((quote) => (
                <li key={quote.id}>
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="flex items-center justify-between rounded-lg border bg-background p-4 hover:bg-accent"
                  >
                    <div>
                      <p className="font-medium">{quote.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatQuoteNumber(ctx.company.quotePrefix, quote.number)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={QUOTE_STATUS_CLASS[quote.status]}>
                        {tQuotes(`status.${quote.status}`)}
                      </Badge>
                      <span className="tabular-nums">
                        {formatMoney(Number(quote.total), quote.currency, ctx.company.formatLocale)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
