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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
          <span className="min-w-0 truncate text-sm text-muted-foreground">{email}</span>
          <form
            className="shrink-0"
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
