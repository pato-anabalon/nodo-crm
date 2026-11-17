import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandedLoader } from "@/components/branded-loader";

export default async function ClientDetailLoading() {
  const t = await getTranslations("clients.loading");
  return <BrandedLoader icon={Building2} title={t("title")} subtitle={t("subtitle")} />;
}
