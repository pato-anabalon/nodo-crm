import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ROOT_DOMAIN } from "@/lib/tenant/host";
import { CompanyFinder } from "./company-finder";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: `${t("signInTitle")} · Nodo CRM` };
}

/**
 * Entry from the root domain.
 *
 * Each company lives on its own subdomain, so there's no central session: what's
 * needed here is to take the person to the right address.
 */
export default async function SignInPage() {
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("signInTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("findCompanyBody")}</p>
      </div>

      <CompanyFinder rootDomain={ROOT_DOMAIN} />

      <p className="text-center text-sm text-muted-foreground">
        {t("noCompanyYet")}{" "}
        <Link href="/register" className="underline underline-offset-4">
          {t("createCompany")}
        </Link>
      </p>
    </main>
  );
}
