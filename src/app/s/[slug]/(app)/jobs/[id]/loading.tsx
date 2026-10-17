import { Briefcase } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandedLoader } from "@/components/branded-loader";

export default async function JobDetailLoading() {
  const t = await getTranslations("jobs.loading");
  return <BrandedLoader icon={Briefcase} title={t("title")} subtitle={t("subtitle")} />;
}
