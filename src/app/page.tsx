import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/aurora-background";
import { ROOT_DOMAIN } from "@/lib/tenant/host";

/** The root domain's public site. Each company lives on its own subdomain. */
export default async function Home() {
  const t = await getTranslations("marketing");

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />

      <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">{t("title")}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance">{t("headline")}</h1>
          <p className="text-lg text-muted-foreground text-pretty">
            {t.rich("subhead", {
              domain: () => (
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">yourcompany.{ROOT_DOMAIN}</code>
              ),
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">{t("createCompany")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">{t("haveAccount")}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
