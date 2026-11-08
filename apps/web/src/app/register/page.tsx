import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuroraBackground } from "@/components/aurora-background";
import { RegisterForm } from "./register-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: `${t("createCompany")} · Nodo CRM` };
}

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ company?: string | string[] }> }) {
  const { company } = await searchParams;
  // The name typed into the public page's brand demo, so it isn't typed twice.
  const initialCompanyName = typeof company === "string" ? company.slice(0, 100) : "";
  const t = await getTranslations("auth");

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("signUpTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("signUpSubtitle")}</p>
        </div>

        <RegisterForm initialCompanyName={initialCompanyName} />

        <p className="text-center text-sm text-muted-foreground">
          {t("alreadyHaveAccount")}{" "}
          <Link href="/sign-in" className="underline underline-offset-4">
            {t("signInHere")}
          </Link>
        </p>
      </main>
    </div>
  );
}
