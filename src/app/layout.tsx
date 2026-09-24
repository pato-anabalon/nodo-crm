import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The language isn't in the URL: it comes from the cookie refreshed at sign-in
  // (see src/i18n/request.ts).
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      {/* Browser extensions add attributes to <body> before React hydrates —
          ColorZilla's `cz-shortcut-listen` is the usual one. `suppressHydrationWarning`
          only reaches one level deep, so having it on <html> doesn't cover this. */}
      <body className={`${geist.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <NextIntlClientProvider>
            {children}
            {/*
              Top centre, not top right: the right is where the action buttons
              live — Send, Accept, Save — so a snackbar there covered the very
              control that had just been pressed.

              Six seconds rather than sonner's four. Half again as long is the
              difference between reading it and catching that something flashed.
            */}
            <Toaster richColors position="top-center" duration={6000} />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
