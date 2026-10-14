import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { SettingsHeader } from "@/modules/settings/settings-header";
import { listTrades } from "@/modules/jobs/service";
import { createTradeAction, deleteTradeAction } from "@/modules/jobs/actions";
import { TradesManager } from "@/modules/jobs/trades-manager";

export async function generateMetadata() {
  const t = await getTranslations("trades");
  return { title: t("title") };
}

export default async function TradesPage() {
  const ctx = await requirePermission("settings.read");
  const t = await getTranslations("trades");
  const trades = await listTrades(ctx);

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />
      <TradesManager
        trades={trades.map((trade) => ({ id: trade.id, name: trade.name, people: trade._count.memberships }))}
        canManage={can(ctx, "settings.update")}
        onAdd={createTradeAction}
        onDelete={deleteTradeAction}
      />
    </div>
  );
}
