import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/components/company-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/i18n/config";

export async function UserMenu({
  name,
  email,
  image,
  roleName,
  locale,
}: {
  name: string | null;
  email: string;
  image: string | null;
  roleName: string;
  locale: Locale;
}) {
  const [t, tAccount, tNotices] = await Promise.all([
    getTranslations("common"),
    getTranslations("account"),
    getTranslations("notificationSettings"),
  ]);
  const display = name ?? email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="size-7">
            {image ? <AvatarImage src={image} alt={display} /> : null}
            <AvatarFallback className="text-xs">{initials(display)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{display}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{display}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{roleName}</p>
        </DropdownMenuLabel>

        {/*
          The only way into a personal setting for a profile without
          `settings.read` — the sidebar's own Settings link needs that
          permission, so a Sales or Viewer profile never sees it there, even
          though neither of these pages asks for any permission once reached.
          This menu is the one thing every signed-in person already has.
        */}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">{tAccount("title")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/notifications">{tNotices("title")}</Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <LocaleSwitcher current={locale} />

        <DropdownMenuSeparator />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              {t("signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
