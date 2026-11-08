import { getTranslations } from "next-intl/server";
import { CompanyLogo } from "@/components/company-logo";
import { BrandImageCard } from "./brand-image-card";
import { removeLogoAction, uploadLogoAction } from "./actions";

/**
 * The company's logo, as a file rather than a pasted address.
 *
 * Previewed through the same `CompanyLogo` the rest of the system uses, so what
 * is shown here is literally what the sidebar and the customer's quote render —
 * initials included, when there is no logo.
 */
export async function LogoManager({
  companyName,
  logoUrl,
  canManage,
}: {
  companyName: string;
  logoUrl: string | null;
  canManage: boolean;
}) {
  const t = await getTranslations("settings.logo");

  return (
    <BrandImageCard
      kind="logo"
      preview={<CompanyLogo name={companyName} logoUrl={logoUrl} size="lg" />}
      hasImage={Boolean(logoUrl)}
      canManage={canManage}
      uploadAction={uploadLogoAction}
      removeAction={removeLogoAction}
      labels={{
        title: t("title"),
        subtitle: t("subtitle"),
        upload: t("upload"),
        choose: t("choose"),
        noneChosen: t("noneChosen"),
        save: t("save"),
        uploading: t("uploading"),
        hint: t("hint"),
        remove: t("remove"),
        removeTitle: t("removeTitle"),
        removeConfirm: t("removeConfirm", { company: companyName }),
      }}
    />
  );
}
