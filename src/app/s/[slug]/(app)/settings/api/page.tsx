import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { listIngestKeys, listRecentRejections } from "@/modules/ingest/service-admin";
import { IngestKeysManager } from "@/modules/ingest/keys-manager";
import { RejectionLog } from "@/modules/ingest/rejection-log";
import { ROOT_DOMAIN } from "@/lib/tenant/host";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("ingest");
  return { title: t("title") };
}

export default async function ApiPage() {
  const ctx = await requirePermission("settings.read");
  const t = await getTranslations("ingest");

  const [keys, rejections] = await Promise.all([
    listIngestKeys(ctx),
    listRecentRejections(ctx),
  ]);

  const protocol = ROOT_DOMAIN.startsWith("localhost") ? "http" : "https";
  const endpoint = `${protocol}://${ROOT_DOMAIN}/api/v1/leads`;

  return (
    <div className="space-y-8">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <IngestKeysManager
        keys={keys.map((key) => ({
          id: key.id,
          name: key.name,
          type: key.type,
          prefix: key.prefix,
          allowedOrigins: key.allowedOrigins,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          revoked: key.revokedAt !== null,
          leadCount: key._count.submissions,
        }))}
        canManage={ctx.permissions.has("settings.update")}
        endpoint={endpoint}
        formatLocale={ctx.company.formatLocale}
        timezone={ctx.company.timezone}
      />

      <RejectionLog
        rejections={rejections.map((r) => ({
          id: r.id,
          outcome: r.outcome,
          origin: r.origin,
          detail: r.detail,
          createdAt: r.createdAt,
          keyName: r.ingestKey?.name ?? null,
        }))}
        formatLocale={ctx.company.formatLocale}
        timezone={ctx.company.timezone}
      />
    </div>
  );
}
