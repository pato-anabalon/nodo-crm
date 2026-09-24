import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

/**
 * The heading of a settings screen, with the way back beside it.
 *
 * Every one of these is reached from the index and has nowhere else to go, but
 * the only way back was the sidebar's Settings — which is a link to the module,
 * not to the screen you came from, and reads as leaving rather than returning.
 *
 * The header itself was written out eleven times, identically. It is one
 * component now for the same reason the arrow is: the twelfth screen gets both
 * without anybody remembering to add them.
 */
export async function SettingsHeader({
  title,
  subtitle,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * Where the arrow goes, for a screen that hangs off another screen rather
   * than off the index — a profile's permission grid returns to Profiles.
   */
  back?: { href: string; label: string };
}) {
  const t = await getTranslations("settings");
  const target = back ?? { href: "/settings", label: t("title") };

  return (
    <div className="flex items-start gap-2">
      {/*
        `-ml-2` cancels the button's own padding, so the arrow's glyph starts on
        the page's left edge rather than a few pixels inside it — the title is
        indented by the arrow, which is the point, but the row is not.
      */}
      <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
        {/* Names the destination: "back" alone is not somewhere you can picture. */}
        <Link href={target.href} aria-label={t("back", { section: target.label })}>
          <ArrowLeft className="size-4" />
        </Link>
      </Button>

      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
