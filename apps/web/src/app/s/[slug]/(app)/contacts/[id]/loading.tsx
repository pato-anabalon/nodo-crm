import { Contact } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandedLoader } from "@/components/branded-loader";

export default async function ContactDetailLoading() {
  const t = await getTranslations("contacts.loading");
  return <BrandedLoader icon={Contact} title={t("title")} subtitle={t("subtitle")} />;
}
