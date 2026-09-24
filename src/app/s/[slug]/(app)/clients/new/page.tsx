import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { createClientCompanyAction } from "@/modules/client-companies/actions";
import { ClientCompanyForm } from "@/modules/client-companies/client-company-form";

export default async function NewClientPage() {
  await requirePermission("contacts.create");
  const [t, tCommon] = await Promise.all([
    getTranslations("clients"),
    getTranslations("common"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/clients" aria-label={t("title")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{t("new")}</h1>
      </div>

      <ClientCompanyForm action={createClientCompanyAction} submitLabel={tCommon("save")} />
    </div>
  );
}
