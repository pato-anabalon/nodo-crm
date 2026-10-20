import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { listCompanies } from "@/modules/platform/service";
import { CompanyList } from "@/modules/platform/company-list";
import { Button } from "@/components/ui/button";

export default async function PlatformAdminPage() {
  const { email } = await requirePlatformAdmin();
  const [companies, t, tCommon] = await Promise.all([
    listCompanies(),
    getTranslations("platform"),
    getTranslations("common"),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-muted-foreground">{email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              {tCommon("signOut")}
            </Button>
          </form>
        </div>
      </div>

      <CompanyList companies={companies} />
    </main>
  );
}
