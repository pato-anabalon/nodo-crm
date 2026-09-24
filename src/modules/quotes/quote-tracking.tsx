"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Presence = {
  shared: boolean;
  viewingNow: boolean;
  openCount: number;
  lastSeenAt: string | null;
};

/** How often the panel asks. Shorter than this is noise. */
const POLL_SECONDS = 15;

/**
 * Tracking the customer on a sent quote.
 *
 * It reports live when the customer has it open — the exact moment to call them —
 * and keeps count of how many times they've opened it.
 */
export function QuoteTracking({
  quoteId,
  initial,
  formatLocale,
  timezone,
}: {
  quoteId: string;
  initial: Presence;
  /** The format belongs to the company; it's applied on the client here because
   *  the last signal updates through polling, not in the server render. */
  formatLocale: string;
  timezone: string;
}) {
  const t = useTranslations("quotes.tracking");
  const [presence, setPresence] = useState(initial);

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(formatLocale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(iso));

  useEffect(() => {
    if (!initial.shared) return;

    const url = `/api/quotes/${encodeURIComponent(quoteId)}/presence`;
    let cancelled = false;

    const poll = async () => {
      // With the tab out of sight there's nobody reading the notice.
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(url);
        if (!response.ok || cancelled) return;
        setPresence((await response.json()) as Presence);
      } catch {
        // A network failure shouldn't break the page; it retries next cycle.
      }
    };

    const timer = setInterval(poll, POLL_SECONDS * 1000);
    document.addEventListener("visibilitychange", poll);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [quoteId, initial.shared]);

  if (!presence.shared) return null;

  return (
    <Card className={presence.viewingNow ? "border-primary" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-2 text-sm">
        {/* Three sizes, and the order is the order of urgency: somebody is on
            the quote right now, it has been opened this often, it was last seen
            then. The sizes are what makes that order readable without reading. */}
        {presence.viewingNow ? (
          <p className="flex items-center gap-2 text-lg font-medium text-primary">
            <Radio className="size-5 shrink-0 animate-pulse" />
            {t("viewingNow")}
          </p>
        ) : null}

        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <Eye className="size-4.5 shrink-0" />
          {t("openCount", { count: presence.openCount })}
        </p>

        {presence.lastSeenAt && !presence.viewingNow ? (
          <p className="text-xs text-muted-foreground">
            {t("lastSeen", { date: formatTime(presence.lastSeenAt) })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
