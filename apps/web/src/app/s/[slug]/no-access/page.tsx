import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { getCompanyBySlug } from "@/lib/tenant/company";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: `${t("noAccessTitle")} · Nodo CRM` };
}

/** The user has a session, but doesn't belong to this company. */
export default async function SinAccesoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [t, tCommon] = await Promise.all([
    getTranslations("auth"),
    getTranslations("common"),
  ]);
  const company = await getCompanyBySlug(slug);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("noAccessTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("noAccessBody", { company: company?.name ?? t("thisCompany") })}
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="outline" className="w-full">
          {tCommon("signOut")}
        </Button>
      </form>
    </main>
  );
}
