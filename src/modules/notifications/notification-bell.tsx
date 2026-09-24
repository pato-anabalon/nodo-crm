"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { markAllReadAction, markNotificationReadAction } from "./actions";

type Item = { id: string; text: string; href: string | null; read: boolean; at: string };

/** Same cadence as the rest of the polling in this app. */
const POLL_SECONDS = 60;

/**
 * The bell.
 *
 * Reads its own feed rather than being handed one by the layout, so the count
 * moves while somebody is sitting on a page — and so that asking is what turns
 * an overdue task into a notice, which needs no scheduled job at all.
 */
export function NotificationBell({
  initialUnread = 0,
  initialItems = [],
}: {
  initialUnread?: number;
  initialItems?: Item[];
}) {
  const t = useTranslations("notifications.bell");
  const [items, setItems] = useState<Item[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) return;
      const data = (await response.json()) as { unread: number; items: Item[] };
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      // What's on screen is still valid; the next poll is a minute away.
    }
  }, []);

  // The effect only subscribes; the first count came from the server, so the
  // bell is right on the first paint instead of a fetch later.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(tick, POLL_SECONDS * 1000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  function open(next: boolean) {
    if (next) void load();
  }

  function read(id: string) {
    setUnread((current) => Math.max(0, current - 1));
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  }

  function readAll() {
    setUnread(0);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    startTransition(async () => {
      await markAllReadAction();
    });
  }

  return (
    <DropdownMenu onOpenChange={open}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-[var(--status-viewing)] text-[10px] font-semibold text-white tabular-nums"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
          <span className="sr-only">
            {unread > 0 ? t("withUnread", { count: unread }) : t("label")}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{t("title")}</span>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={readAll}>
              {t("markAllRead")}
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((item) => {
              const body = (
                <>
                  <span className={cn("text-sm", !item.read && "font-medium")}>{item.text}</span>
                  <span className="block text-xs text-muted-foreground">{item.at}</span>
                </>
              );

              return (
                <li key={item.id} className="border-b last:border-0">
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => read(item.id)}
                      className={cn(
                        "block px-3 py-2.5 hover:bg-accent",
                        !item.read && "bg-panel",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => read(item.id)}
                      className={cn(
                        "block w-full px-3 py-2.5 text-left hover:bg-accent",
                        !item.read && "bg-panel",
                      )}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
