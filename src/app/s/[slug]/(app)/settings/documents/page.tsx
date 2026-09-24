import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { listCompanyDocuments } from "@/modules/documents/service";
import { DocumentsManager } from "@/modules/documents/documents-manager";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("documents");
  return { title: t("title") };
}

export default async function DocumentosPage() {
  const ctx = await requirePermission("settings.read");
  const t = await getTranslations("documents");

  const documents = await listCompanyDocuments(ctx);

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <DocumentsManager
        documents={documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          url: doc.url,
          size: doc.size,
          isDefault: doc.isDefault,
        }))}
        canManage={ctx.permissions.has("settings.update")}
        formatLocale={ctx.company.formatLocale}
      />
    </div>
  );
}
