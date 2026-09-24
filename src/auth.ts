import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { credentialsSchema } from "@/lib/auth/schemas";

/**
 * Auth.js resolves *who* the user is, not *which company* they're in: the company
 * comes from the subdomain and membership is verified on every request
 * (see src/lib/auth/session.ts). That way a user of several companies never
 * drags permissions from one into another.
 */
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const isLocal = rootDomain.startsWith("localhost");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  // A single session across every subdomain: whoever belongs to two companies
  // signs in once. Access is still checked company by company.
  // Locally the default is left alone, because browsers don't share cookies
  // between `localhost` subdomains.
  cookies: isLocal
    ? undefined
    : {
        sessionToken: {
          name: "__Secure-authjs.session-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true,
            domain: `.${rootDomain.split(":")[0]}`,
          },
        },
      },
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
