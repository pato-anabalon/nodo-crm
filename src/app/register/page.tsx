import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "./register-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: `${t("createCompany")} · Nodo CRM` };
}

export default async function RegistroPage() {
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("signUpTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("signUpSubtitle")}</p>
      </div>

      <RegisterForm />

      <p className="text-center text-sm text-muted-foreground">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/sign-in" className="underline underline-offset-4">
          {t("signInHere")}
        </Link>
      </p>
    </main>
  );
}
