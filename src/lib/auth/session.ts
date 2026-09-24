import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { forCompany, type TenantClient } from "@/lib/db/tenant";
import { companySlugFromHost, companyUrl } from "@/lib/tenant/host";
import { isPermission, type Permission } from "./permissions";
import { languageToLocale, type Locale } from "@/i18n/config";
import { Language, MembershipStatus, SenderNameStyle, type TaxType } from "@/generated/prisma/enums";

export type CompanyContext = {
  user: { id: string; name: string | null; email: string; image: string | null };
  company: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    watermarkUrl: string | null;
    primaryColor: string;
    accentColor: string;
    /** The company's currency; a quote keeps its own copy once issued. */
    currency: string;
    /** How numbers and dates look (en-NZ), independent of the user's language. */
    formatLocale: string;
    /** The language quotes go out in towards the customer. */
    defaultLanguage: Language;
    timezone: string;
    defaultTaxType: TaxType;
    defaultTaxRate: number;
    /** Whether the amounts entered already carry the tax inside. */
    pricesIncludeTax: boolean;
    /** Copy that accompanies every quote the company issues. */
    quoteIntro: string | null;
    quoteNotes: string | null;
    quoteExclusions: string | null;
    quoteTerms: string | null;
    quotePrefix: string;
    quoteValidityDays: number;
    /** Closes every email the company sends. */
    quoteFooter: string | null;
    /** Sits under the button in the quote email. */
    slogan: string | null;
    /** Whose name the customer reads in the From line. */
    senderNameStyle: SenderNameStyle;
    /** Whether sending a quote also copies the priced version to the company. */
    sendQuoteCopy: boolean;
    /** Where that copy goes; falls back to whoever pressed Send. */
    email: string | null;
  };
  /** `name` is null on standard profiles: it's translated from `key`. */
  role: { id: string; key: string; name: string | null };
  /** This user's language, already resolved against the company's. */
  locale: Locale;
  permissions: Set<Permission>;
  /** Prisma client already scoped to this company. */
  db: TenantClient;
};

/** The company slug taken from the current request's subdomain. */
export const currentCompanySlug = cache(async (): Promise<string | null> => {
  const host = (await headers()).get("host");
  return companySlugFromHost(host);
});

/**
 * The full context, or null when session, company or active membership is
 * missing. Cached per request so the query isn't repeated in every component.
 */
export const getCompanyContext = cache(async (): Promise<CompanyContext | null> => {
  const [session, slug] = await Promise.all([auth(), currentCompanySlug()]);

  const userId = session?.user?.id;
  if (!userId || !slug) return null;

  // A deliberately cross-company query: this is the one place where we work out
  // which company the user belongs to. From here on everything goes through `db`.
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      company: { slug, isActive: true },
    },
    include: {
      user: true,
      company: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  if (!membership) return null;

  const permissions = new Set<Permission>();
  for (const rp of membership.role.permissions) {
    if (isPermission(rp.permission.key)) permissions.add(rp.permission.key);
  }

  const { company, user, role } = membership;

  return {
    user: { id: user.id, name: user.name, email: user.email, image: user.image },
    company: {
      id: company.id,
      slug: company.slug,
      name: company.name,
      logoUrl: company.logoUrl,
      watermarkUrl: company.watermarkUrl,
      primaryColor: company.primaryColor,
      accentColor: company.accentColor,
      currency: company.currency,
      formatLocale: company.formatLocale,
      defaultLanguage: company.defaultLanguage,
      timezone: company.timezone,
      defaultTaxType: company.defaultTaxType,
      defaultTaxRate: Number(company.defaultTaxRate),
      pricesIncludeTax: company.pricesIncludeTax,
      quoteIntro: company.quoteIntro,
      quoteNotes: company.quoteNotes,
      quoteExclusions: company.quoteExclusions,
      quoteTerms: company.quoteTerms,
      quotePrefix: company.quotePrefix,
      quoteValidityDays: company.quoteValidityDays,
      quoteFooter: company.quoteFooter,
      slogan: company.slogan,
      senderNameStyle: company.senderNameStyle,
      sendQuoteCopy: company.sendQuoteCopy,
      email: company.email,
    },
    role: { id: role.id, key: role.key, name: role.name },
    locale: languageToLocale(user.language ?? company.defaultLanguage ?? Language.EN_GB),
    permissions,
    db: forCompany(company.id),
  };
});

/** For pages and server actions: guarantees session + membership, or redirects. */
export async function requireCompanyContext(): Promise<CompanyContext> {
  const ctx = await getCompanyContext();
  if (ctx) return ctx;

  const slug = await currentCompanySlug();
  if (!slug) redirect("/");

  const session = await auth();
  // Signed in but without membership: the user doesn't belong to this company.
  redirect(session?.user?.id ? "/no-access" : "/login");
}

export function can(ctx: CompanyContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Falta el permiso ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** Permission guard for server actions. Throws when the profile lacks it. */
export async function requirePermission(permission: Permission): Promise<CompanyContext> {
  const ctx = await requireCompanyContext();
  if (!can(ctx, permission)) throw new ForbiddenError(permission);
  return ctx;
}

export { companyUrl };
