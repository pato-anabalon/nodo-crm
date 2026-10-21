import { getTranslations } from "next-intl/server";
import { NotFoundScene } from "@/modules/marketing/not-found-scene";
import { ROOT_DOMAIN, rootProtocol } from "@/lib/tenant/host";
import "./not-found.css";

/**
 * What anybody sees at an address that doesn't resolve — and, most often, what
 * a new company's owner sees at their own subdomain until a platform admin
 * switches it on: an inactive company is indistinguishable from one that
 * doesn't exist (`getCompanyBySlug`), on purpose, so the page can't be used to
 * find out which names are registered. That is why it says "isn't open yet"
 * rather than "doesn't exist", and why it doesn't name the company.
 *
 * The way out points at the root domain, not `/`: on a company's subdomain `/`
 * is the very page that just failed.
 */
export default async function NotFound() {
  const t = await getTranslations("notFound");
  const root = `${rootProtocol()}://${ROOT_DOMAIN}`;

  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-[linear-gradient(to_bottom,#145bb5_0%,#1d6fd8_55%,#67b4f4_85%,#a7d8fa_100%)] text-white">
      <div className="nf-rise relative z-10 mx-auto w-full max-w-2xl px-6 pt-16 text-center sm:pt-24">
        <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ring-1 ring-white/30">
          {t("eyebrow")}
        </p>
        <h1 className="mt-5 text-balance text-4xl font-medium leading-[1.08] tracking-[-0.03em] drop-shadow-sm sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-white/90 sm:text-lg">{t("body")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={root}
            className="rounded-xl bg-white px-5 py-3.5 font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-100 active:scale-[0.98]"
          >
            {t("home")}
          </a>
          <a
            href={`${root}/sign-in`}
            className="rounded-xl bg-white/15 px-5 py-3.5 text-white ring-1 ring-white/30 backdrop-blur-md transition hover:bg-white/25"
          >
            {t("signIn")}
          </a>
        </div>
      </div>

      <div className="mt-auto pt-10">
        <NotFoundScene label={t("sceneAlt")} />
      </div>
    </main>
  );
}
