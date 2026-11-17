"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

/**
 * Light and dark, switched by a class on <html>.
 *
 * The choice is kept in `localStorage` and applied by a blocking script before
 * the first paint, which is what stops the page flashing white on its way to
 * dark. `<html>` already carries `suppressHydrationWarning` for exactly this:
 * the server can't know the choice, so that attribute is expected to differ.
 *
 * `enableSystem` is off: the toggle offers two states because that is what was
 * asked for, and defaulting to the operating system would have silently moved
 * everyone who already works in a dark desktop.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
