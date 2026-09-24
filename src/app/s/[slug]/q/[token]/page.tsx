import { getTranslations } from "next-intl/server";
import { languageToLocale } from "@/i18n/config";
import { resolveShare } from "@/modules/portal/service";
import { QuoteDocument } from "@/modules/portal/quote-document";

/**
 * The quote as the end customer sees it.
 *
 * The only page in the system without a session: the link authorises viewing and
 * answering this quote and nothing else. That's why everything shown comes from
 * the resolved `share`, never from an id carried in the URL.
 */
export default async function ClientQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { status, share } = await resolveShare(token);

  if (status !== "ok" || !share) {
    return <InvalidLink status={status} />;
  }

  const { company, quote } = share;

  /**
   * The portal speaks the **quote's** language, not the customer's browser's. A
   * New Zealand company quoting in English shouldn't show the page in Spanish to
   * a customer just because their browser is set that way.
   */
  const locale = languageToLocale(quote.language);

  /*
   * The opening is **not** recorded here.
   *
   * A render is not a visit. Every action in the portal — accepting, declining,
   * sending a message — revalidates this page, so recording here counted each
   * of them as another opening: in the event log, and in the counter the
   * company reads beside "viewing now". The first beat of the heartbeat says it
   * instead, because a beat comes from a browser with the page in front of
   * somebody. See `api/q/[token]/ping`.
   */
  return <QuoteDocument company={company} quote={quote} locale={locale} token={token} />;
}

/** A link that doesn't exist, was revoked or expired. Speaks the browser's language. */
async function InvalidLink({ status }: { status: string }) {
  const t = await getTranslations("portal");
  const body =
    status === "revoked"
      ? t("revokedBody")
      : status === "expired"
        ? t("expiredBody")
        : t("notFoundBody");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </main>
  );
}
