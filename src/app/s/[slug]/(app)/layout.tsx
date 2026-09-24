import { getTranslations } from "next-intl/server";
import { requireCompanyContext } from "@/lib/auth/session";
import { visibleNavItems } from "@/lib/navigation";
import { roleDisplayName } from "@/lib/auth/role-name";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import { ScrollReset } from "@/components/scroll-reset";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/modules/notifications/notification-bell";
import { unreadCount } from "@/modules/notifications/inbox";

/**
 * Everything hanging off here requires a session with active membership in the
 * subdomain's company. `requireCompanyContext` redirects if either is missing.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCompanyContext();
  const items = visibleNavItems(ctx.permissions);
  const tRoles = await getTranslations("roles");

  // Read on the server so the bell is right on the first paint; from then on it
  // keeps itself up to date.
  const unread = await unreadCount(ctx);

  return (
    // A frame the height of the viewport: the sidebar and the header stay put and
    // only the main pane scrolls. `dvh` rather than `vh` so the mobile browser's
    // collapsing toolbar doesn't leave a strip of content unreachable.
    <div className="app-shell flex h-dvh overflow-hidden bg-background">
      <AppSidebar
        companyName={ctx.company.name}
        logoUrl={ctx.company.logoUrl}
        items={items}
      />

      <ScrollReset target="main" />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 shrink-0 items-center justify-end gap-1 border-b bg-background px-6">
          <ThemeToggle />

          <NotificationBell initialUnread={unread} />

          <UserMenu
            name={ctx.user.name}
            email={ctx.user.email}
            image={ctx.user.image}
            roleName={roleDisplayName(ctx.role, tRoles)}
            locale={ctx.locale}
          />
        </header>

        {/* `min-h-0` is what actually lets this scroll: without it a flex child
            refuses to shrink below its content and the frame grows instead. */}
        <main id="main" className="app-main min-h-0 min-w-0 flex-1 overflow-y-auto bg-panel p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
