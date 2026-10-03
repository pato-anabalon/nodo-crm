import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { LeadForm } from "@/modules/leads/lead-form";
import { createLeadAction } from "@/modules/leads/actions";
import { searchContactsAction } from "@/modules/contacts/actions";
import { listCompanyMembers } from "@/modules/team/service";

export async function generateMetadata() {
  const t = await getTranslations("leads");
  return { title: t("new") };
}

export default async function NuevoLeadPage() {
  const ctx = await requirePermission("leads.create");
  const t = await getTranslations("leads");

  const canAssign = ctx.permissions.has("leads.assign");
  const members = canAssign ? await listCompanyMembers(ctx) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/leads" aria-label={t("backToLeads")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{t("new")}</h1>
      </div>

      <LeadForm
        action={createLeadAction}
        members={members}
        canAssign={canAssign}
        submitLabel={t("create")}
        currency={ctx.company.currency}
        searchContacts={searchContactsAction}
        defaults={{ ownerId: ctx.user.id }}
      />
    </div>
  );
}
