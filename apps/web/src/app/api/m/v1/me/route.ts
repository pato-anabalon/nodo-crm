import { mobileRoute } from "@/modules/mobile/route";

/**
 * Who is working, in which company, and what their profile lets them do — what
 * the app needs to brand itself and decide which tabs to show. The server still
 * checks every permission on every request; this list only decides what is offered.
 */
export const GET = mobileRoute({
  handler: async ({ ctx }) => ({
    user: ctx.user,
    company: {
      id: ctx.company.id,
      slug: ctx.company.slug,
      name: ctx.company.name,
      logoUrl: ctx.company.logoUrl,
      primaryColor: ctx.company.primaryColor,
      accentColor: ctx.company.accentColor,
      currency: ctx.company.currency,
      formatLocale: ctx.company.formatLocale,
      timezone: ctx.company.timezone,
    },
    role: ctx.role,
    locale: ctx.locale,
    permissions: [...ctx.permissions].sort(),
  }),
});
