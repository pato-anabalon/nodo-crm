import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandedLoader } from "@/components/branded-loader";

export default async function LeadDetailLoading() {
  const t = await getTranslations("leads.loading");
  return <BrandedLoader icon={Users} title={t("title")} subtitle={t("subtitle")} />;
}
