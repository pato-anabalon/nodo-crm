"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Switches between light and dark.
 *
 * Which icon shows is decided by CSS rather than by React state, so the button
 * renders the same on the server as on the client and needs no "wait until
 * mounted" dance. The current theme is read off the document for the same
 * reason: it is correct from the very first click.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();
  const t = useTranslations("theme");

  function toggle() {
    const dark = document.documentElement.classList.contains("dark");
    setTheme(dark ? "light" : "dark");
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle}>
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
      <span className="sr-only dark:hidden">{t("toDark")}</span>
      <span className="sr-only hidden dark:inline">{t("toLight")}</span>
    </Button>
  );
}
