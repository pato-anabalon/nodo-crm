import NextAuth from "next-auth";
import { headers } from "next/headers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { credentialsSchema } from "@/lib/auth/schemas";
import { canRequestMagicLink } from "@/lib/auth/magic-link-gate";
import { companySlugFromHost } from "@/lib/tenant/host";

/**
 * Auth.js resolves *who* the user is, not *which company* they're in: the company
 * comes from the subdomain and membership is verified on every request
 * (see src/lib/auth/session.ts). That way a user of several companies never
 * drags permissions from one into another.
 */
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
// Sharing the cookie across subdomains needs an explicit `Domain`, which is
// pointless on plain `localhost`: the browser won't apply one across sibling
// `*.localhost` hosts anyway, so the default (host-only) is left alone there.
// Anywhere else — the real domain in production, or a wildcard-DNS trick like
// lvh.me for exercising this locally over plain HTTP — it's worth setting.
const shareAcrossSubdomains = !rootDomain.startsWith("localhost");
// `next dev` is always HTTP, whatever ROOT_DOMAIN says; a Vercel build —
// preview or production — is always HTTPS. `Secure`, and the `__Secure-`
// name prefix it's paired with, are what a browser needs HTTPS for: get this
// wrong and the browser drops the cookie silently rather than rejecting it,
// which reads as "the login did nothing".
const isSecureContext = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  // A single session across every subdomain: whoever belongs to two companies
  // signs in once. Access is still checked company by company.
  cookies: shareAcrossSubdomains
    ? {
        sessionToken: {
          name: isSecureContext ? "__Secure-authjs.session-token" : "authjs.session-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: isSecureContext,
            domain: `.${rootDomain.split(":")[0]}`,
          },
        },
      }
    : undefined,
  // Required with the credentials provider.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verificar",
    error: "/login",
  },
  providers: [
    Resend({
      // The same key the quote sending uses; `AUTH_RESEND_KEY` stays as an
      // alias in case Vercel's integration provisions it.
      apiKey: process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      name: "Email",
    }),
    Credentials({
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    // Auth.js's own trust boundary: this fires for *every* path into a
    // provider, including the framework's own `/api/auth/signin/:provider`
    // route — not just the form action this app happens to call it from.
    // A check that only lived in that action would be one an attacker could
    // skip by calling the route directly. See the comment on
    // `canRequestMagicLink` for the full reasoning.
    async signIn({ user, account, email }) {
      if (account?.provider !== "resend" || !email?.verificationRequest) return true;
      if (!user.email) return false;

      const incoming = await headers();
      const slug = companySlugFromHost(incoming.get("host"));
      if (!slug) return false;

      return canRequestMagicLink({ slug, email: user.email, headers: incoming });
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
