import { FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandedLoader } from "@/components/branded-loader";

export default async function QuoteDetailLoading() {
  const t = await getTranslations("quotes.loading");
  return <BrandedLoader icon={FileText} title={t("title")} subtitle={t("subtitle")} />;
}
