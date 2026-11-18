"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuoteLive } from "./quote-live";

export type QuoteTab = "quote" | "activity";

/**
 * A saved quote in two halves: what it says, and what has happened to it.
 *
 * Both stay mounted and the inactive one is only hidden. The first holds the
 * edit form, and unmounting it to glance at the tracking would throw away
 * whatever was being typed; the second holds the cards the live poll feeds.
 *
 * The tab is kept in the address (`?tab=activity`) by replacing the entry
 * rather than navigating, so a reload comes back to it without the page being
 * fetched again on every switch. The Activity tab carries the "viewing now"
 * dot, read from the same poll, so nobody has to switch tabs to find out.
 */
export function QuoteTabs({
  initialTab,
  quote,
  activity,
}: {
  initialTab: QuoteTab;
  quote: ReactNode;
  activity: ReactNode;
}) {
  const t = useTranslations("quotes.tabs");
  const [tab, setTab] = useState<QuoteTab>(initialTab);
  const viewing = useQuoteLive()?.presence.viewingNow ?? false;

  function change(value: string) {
    const next: QuoteTab = value === "activity" ? "activity" : "quote";
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "quote") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={change} className="gap-6">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="quote" className="sm:px-4">
          {t("quote")}
        </TabsTrigger>
        <TabsTrigger value="activity" className="sm:px-4">
          {t("activity")}
          {viewing ? (
            <span className="relative flex size-2" title={t("viewingNow")}>
              <span className="absolute inline-flex size-full rounded-full bg-[var(--status-viewing)] opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--status-viewing)]" />
              <span className="sr-only">{t("viewingNow")}</span>
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="quote" forceMount className="data-[state=inactive]:hidden">
        {quote}
      </TabsContent>
      <TabsContent value="activity" forceMount className="data-[state=inactive]:hidden">
        {activity}
      </TabsContent>
    </Tabs>
  );
}
