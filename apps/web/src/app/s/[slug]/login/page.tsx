import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { getCompanyBySlug } from "@/lib/tenant/company";
import { getCompanyContext } from "@/lib/auth/session";
import { CompanyLogo } from "@/components/company-logo";
import { AuroraBackground } from "@/components/aurora-background";
import { auroraPalette } from "@/lib/theme/color";
import { LoginForm } from "./login-form";
import { requestMagicLink } from "./actions";

/**
 * The one screen forced to English, on purpose.
 *
 * Everywhere else the language is the user's own choice — but here nobody has
 * signed in yet, so "the user's choice" can only mean the browser's
 * `Accept-Language`, which is a guess and not a preference anyone made inside
 * Nodo. `getTranslations`/`getMessages` take an explicit `locale` for exactly
 * this: asking for one is what the request config honours over the cookie or
 * the header (see `resolveLocale` in `src/i18n/request.ts`). The nested
 * `NextIntlClientProvider` carries that same override down to `LoginForm`,
 * a client component that would otherwise read the page's ambient locale.
 */
const LOCALE = "en-GB" as const;

export async function generateMetadata() {
  const t = await getTranslations({ locale: LOCALE, namespace: "auth" });
  return { title: `${t("signInTitle")} · Nodo CRM` };
}

export default async function LoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [t, messages] = await Promise.all([
    getTranslations({ locale: LOCALE, namespace: "auth" }),
    getMessages({ locale: LOCALE }),
  ]);

  // With a valid session in this company, showing the login makes no sense.
  if (await getCompanyContext()) redirect("/");

  const company = await getCompanyBySlug(slug);
  if (!company) redirect("/");

  return (
    <NextIntlClientProvider
      locale={LOCALE}
      messages={{ auth: (messages as Record<string, unknown>).auth }}
    >
      <div className="relative min-h-screen overflow-hidden">
        {/* Built from this company's own primary and accent colours, not the
            generic trio the root domain's sign-in uses: the screen should
            already look like theirs before any session exists. */}
        <AuroraBackground colors={auroraPalette(company.primaryColor, company.accentColor)} />

        <main className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="lg" />
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">{company.name}</h1>
              <p className="text-sm text-muted-foreground">{t("signInSubtitle")}</p>
            </div>
          </div>

          <LoginForm requestMagicLink={requestMagicLink} />
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
