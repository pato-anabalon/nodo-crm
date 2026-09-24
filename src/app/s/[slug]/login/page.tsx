import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCompanyBySlug } from "@/lib/tenant/company";
import { getCompanyContext } from "@/lib/auth/session";
import { CompanyLogo } from "@/components/company-logo";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: `${t("signInTitle")} · Nodo CRM` };
}

export default async function LoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("auth");

  // With a valid session in this company, showing the login makes no sense.
  if (await getCompanyContext()) redirect("/");

  const company = await getCompanyBySlug(slug);
  if (!company) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="lg" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{t("signInSubtitle")}</p>
        </div>
      </div>

      <LoginForm />
    </main>
  );
}
