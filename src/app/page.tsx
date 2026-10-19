import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, PenLine, Receipt } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { ROOT_DOMAIN, rootProtocol } from "@/lib/tenant/host";
import { setLocale } from "@/i18n/actions";
import type { EnquiriesCopy, HeroCopy, JobsCopy, NavCopy, QuotesCopy, RowsCopy } from "@/modules/marketing/copy";
import { FooterLocale } from "@/modules/marketing/footer-locale";
import { Hero } from "@/modules/marketing/hero";
import { MotionProvider } from "@/modules/marketing/motion-provider";
import { Nav } from "@/modules/marketing/nav";
import { Reveal } from "@/modules/marketing/reveal";
import { Enquiries } from "@/modules/marketing/sections/enquiries";
import { Finale, type FinaleCopy } from "@/modules/marketing/sections/finale";
import { JobSite } from "@/modules/marketing/sections/job-site";
import { QuotesFan } from "@/modules/marketing/sections/quotes-fan";
import { Rows } from "@/modules/marketing/sections/rows";
import "./landing.css";

/**
 * Testimonials, shown once there are real ones. Proof is never invented: until
 * a customer has said something, the section isn't rendered at all. Each
 * entry is `{ quote, name, company }`, in the customer's own words.
 */
const REVIEWS: { quote: string; name: string; company: string }[] = [];

/** The founders section, kept and hidden until there is a story and a photo to put in it. */
const SHOW_FOUNDERS = false;

/** The three answers in the strip before the last call to action. */
const TRUST = [
  { key: "nz", icon: Receipt },
  { key: "private", icon: LockKeyhole },
  { key: "sign", icon: PenLine },
] as const;

/**
 * How a link to the page unfurls: the hero's drawing from `/og`, at its full
 * address — crawlers need an absolute URL, and the root domain is the only
 * host this page is served on. Set here rather than in the root layout, so a
 * company's pages and its customers' quote links don't inherit Nodo's pitch.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  const image = { url: "/og", width: 1200, height: 630, alt: t("hero.title") };
  return {
    metadataBase: new URL(`${rootProtocol()}://${ROOT_DOMAIN}`),
    openGraph: {
      type: "website",
      siteName: "Nodo CRM",
      title: `${t("title")} · ${t("hero.title")}`,
      description: t("description"),
      images: [image],
    },
    twitter: { card: "summary_large_image", title: `${t("title")} · ${t("hero.title")}`, description: t("description"), images: [image] },
  };
}

/**
 * The root domain's public site. Each company lives on its own subdomain.
 *
 * A startup landing in two halves: a hero drawn as Auckland, then the product
 * section by section with phones and scroll-driven motion. The copy is read
 * here and handed down already translated; the client pieces get strings,
 * never functions.
 */
export default async function Home() {
  const t = await getTranslations("marketing");
  const locale = await getLocale();
  const year = new Date().getFullYear();

  return (
    <MotionProvider>
      <div className="landing bg-white font-sans text-zinc-900 antialiased">
        <Nav copy={t.raw("nav") as NavCopy} />

        <main>
          <Hero copy={t.raw("hero") as HeroCopy} />
          <Enquiries copy={t.raw("enquiries") as EnquiriesCopy} />
          <QuotesFan copy={t.raw("quotes") as QuotesCopy} />
          <JobSite copy={t.raw("jobs") as JobsCopy} />
          <Rows copy={t.raw("rows") as RowsCopy} />

          {SHOW_FOUNDERS ? (
            <section id="founders" className="bg-zinc-50 px-5 py-24 md:px-8 md:py-32">
              <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[auto_1fr] md:gap-16">
                <Reveal>
                  <Image
                    src="/landing/founders/placeholder.png"
                    alt={t("founders.photoAlt")}
                    width={800}
                    height={1000}
                    className="w-56 rounded-[2rem] object-cover md:w-72"
                  />
                </Reveal>
                <Reveal delay={0.1}>
                  <p className="text-sm font-medium text-[#1a4be0]">{t("founders.kicker")}</p>
                  <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.03em] text-zinc-950 md:text-5xl">{t("founders.title")}</h2>
                  <p className="mt-5 max-w-xl text-pretty text-lg text-zinc-600">{t("founders.body")}</p>
                  <p className="mt-6 font-semibold text-zinc-900">{t("founders.name")}</p>
                  <p className="text-zinc-500">{t("founders.role")}</p>
                </Reveal>
              </div>
            </section>
          ) : null}

          {REVIEWS.length > 0 ? (
            <section className="bg-white px-5 py-24 md:px-8 md:py-32">
              <Reveal as="h2" className="text-center text-4xl font-semibold tracking-[-0.03em] text-zinc-950 md:text-6xl">
                {t("reviews.title")}
              </Reveal>
              <ul className="mx-auto mt-14 flex max-w-5xl flex-wrap justify-center gap-5">
                {REVIEWS.map((review, index) => (
                  <Reveal
                    as="li"
                    key={review.name}
                    delay={index * 0.08}
                    className={`w-72 rounded-3xl p-6 shadow-xl ${["bg-zinc-950 text-white", "bg-[#1a4be0] text-white", "bg-[#bfe0ff]", "bg-white ring-1 ring-zinc-200"][index % 4]} ${index % 2 ? "rotate-2" : "-rotate-2"}`}
                  >
                    <blockquote className="text-pretty">“{review.quote}”</blockquote>
                    <p className="mt-5 text-sm font-semibold">{review.name}</p>
                    <p className="text-sm opacity-70">{review.company}</p>
                  </Reveal>
                ))}
              </ul>
            </section>
          ) : null}

          {/*
            What a buyer actually asks, in a line each: is it made for here, can anybody
            else see my prices, can my customer sign without a desk. Said in their
            terms, not the architecture's.
          */}
          <section aria-label={t("trust.label")} className="bg-white px-5 py-24 md:px-8">
            <ul className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
              {TRUST.map(({ key, icon: Icon }, index) => (
                <Reveal as="li" key={key} delay={index * 0.08} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#1a4be0]/10 text-[#1a4be0]">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="font-semibold text-zinc-950">{t(`trust.${key}.title`)}</h2>
                    <p className="mt-1 text-pretty text-zinc-600">{t(`trust.${key}.body`)}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </section>

          <Finale copy={t.raw("cta") as FinaleCopy} />
        </main>

        {/* The ground the sunrise ends on: the same colour, so the drawing runs into it. */}
        <footer className="bg-[#0b1020] px-5 pb-10 pt-10 text-sm text-zinc-400 md:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-white">Nodo CRM</p>
              <p className="mt-3">
                {t("footer.madeBy")}{" "}
                <a href="https://nodo.co.nz" target="_blank" rel="noopener" className="text-white underline-offset-4 hover:underline">
                  Nodo.co.nz
                </a>
              </p>
            </div>
            <ul className="grid content-start gap-2">
              <li className="text-white">{t("footer.product")}</li>
              <li>
                <a href="#enquiries" className="hover:text-white">
                  {t("nav.enquiries")}
                </a>
              </li>
              <li>
                <a href="#quotes" className="hover:text-white">
                  {t("nav.quotes")}
                </a>
              </li>
              <li>
                <a href="#jobs" className="hover:text-white">
                  {t("nav.jobs")}
                </a>
              </li>
            </ul>
            <ul className="grid content-start gap-2">
              <li className="text-white">{t("footer.account")}</li>
              <li>
                <Link href="/register" className="hover:text-white">
                  {t("nav.createCompany")}
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="hover:text-white">
                  {t("nav.signIn")}
                </Link>
              </li>
            </ul>
          </div>
          <div className="mx-auto mt-12 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-zinc-500">
            <p>{t("footer.legal", { year })}</p>
            <FooterLocale current={locale as Locale} label={t("footer.language")} setLocale={setLocale} />
          </div>
        </footer>
      </div>
    </MotionProvider>
  );
}
