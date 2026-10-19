import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { CompanyLogo } from "@/components/company-logo";
import { languageToLocale } from "@/i18n/config";
import { resolveHandoff } from "@/modules/portal/handoff";
import { PhoneSignaturePad } from "@/modules/portal/phone-signature-pad";

export async function generateMetadata() {
  const t = await getTranslations("portal.handoff");
  return { title: t("phoneTitle"), robots: { index: false } };
}

/**
 * Signing on a phone for a quote open on a computer — the page the QR opens.
 *
 * Outside the authenticated area, like the quote's own link: the token in the
 * QR is all that vouches for whoever holds the phone, and all it lets them do
 * is draw. The quote itself is not shown here; accepting happens on the
 * screen that has the real link.
 */
export default async function SignOnPhonePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const resolved = await resolveHandoff(token);
  // Only on its own company's subdomain: another company's page must not
  // carry somebody else's signing box under its logo.
  const { state, handoff } =
    resolved.handoff?.company.slug === slug ? resolved : { state: "not-found" as const, handoff: null };

  // Speaks the quote's language, like the portal it was opened from.
  const locale = handoff ? languageToLocale(handoff.language) : await getLocale();
  const [t, messages] = await Promise.all([
    getTranslations({ locale, namespace: "portal.handoff" }),
    getMessages({ locale }),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {handoff ? (
        <div className="flex items-center gap-3">
          <CompanyLogo name={handoff.company.name} logoUrl={handoff.company.logoUrl} size="sm" />
          <span className="font-medium">{handoff.company.name}</span>
        </div>
      ) : null}

      {state === "ok" && handoff ? (
        <NextIntlClientProvider
          locale={locale}
          messages={{ portal: (messages as Record<string, unknown>).portal }}
        >
          <PhoneSignaturePad token={token} initialPaths={handoff.paths} />
        </NextIntlClientProvider>
      ) : (
        <div className="rounded-md border p-6 text-center">
          <p className="font-medium">{t("phoneUnavailableTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("phoneUnavailableBody")}</p>
        </div>
      )}
    </main>
  );
}
