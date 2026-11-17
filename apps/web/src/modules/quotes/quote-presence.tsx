"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";

export type PresenceRow = { viewingNow: boolean; openCount: number };
export type PresenceMap = Record<string, PresenceRow>;

/** Same cadence as the quote's own panel — see there for why. */
const POLL_SECONDS = 10;

const PresenceContext = createContext<PresenceMap>({});

/**
 * Keeps the list's presence fresh.
 *
 * A React context rather than props, because the two things it feeds — the dot
 * beside the status and the open count — sit in different cells of the same row
 * and a server component can't hand a client component a function to call.
 *
 * It polls once for the whole page of quotes; see the route for why.
 */
export function QuotePresenceProvider({
  initial,
  children,
}: {
  initial: PresenceMap;
  children: React.ReactNode;
}) {
  const [presence, setPresence] = useState(initial);
  const ids = Object.keys(initial).sort().join(",");

  useEffect(() => {
    if (!ids) return;

    const url = `/api/quotes/presence?ids=${encodeURIComponent(ids)}`;

    const tick = async () => {
      // Nobody is watching a tab that isn't on screen.
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(url);
        if (response.ok) setPresence((await response.json()) as PresenceMap);
      } catch {
        // The row already on screen stays valid; the next tick is seconds away.
      }
    };

    // The same reference for both calls: removing a freshly-made arrow would
    // detach nothing and leave a listener behind on every re-render.
    const onVisibilityChange = () => void tick();

    const timer = setInterval(tick, POLL_SECONDS * 1000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ids]);

  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
}

/** A live dot next to the status when the customer has the quote open. */
export function ViewingNow({ quoteId }: { quoteId: string }) {
  const presence = useContext(PresenceContext);
  const t = useTranslations("quotes.tracking");

  if (!presence[quoteId]?.viewingNow) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--status-viewing)]"
      title={t("viewingNow")}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--status-viewing)] opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-[var(--status-viewing)]" />
      </span>
      {t("viewingNowShort")}
    </span>
  );
}

/** How many times the customer opened it. A dash when no link ever went out. */
/**
 * When the customer last looked, or that they never did.
 *
 * Sits beside the status because it is the most actionable thing on the row: a
 * quote nobody has opened needs a different move from one read this morning. It
 * used to have to be inferred from a zero in a column of counts.
 *
 * Presence wins when somebody is on the page right now — that is more useful
 * than when they last were, and the two would otherwise contradict each other
 * for a few seconds. The phrase itself is worked out on the server and handed
 * over already written, because the wording needs a locale and a timezone and a
 * client component cannot be given the function that knows them.
 *
 * **Only for a quote with a Nodo link.** "Unopened" is a claim — there was a
 * link and the customer didn't follow it — and without one there is nothing
 * to claim: a draft never went out, a quote marked as sent reached the
 * customer some other way, an imported one was opened in whatever system sent
 * it. Saying "Unopened" under "Accepted" is how it read before. The test is
 * the presence row, the same one `OpenCount` reads to show its dash, so the
 * two columns can't disagree about whether a link exists.
 */
export function QuoteSeen({
  quoteId,
  seenLabel,
  card = false,
}: {
  quoteId: string;
  /**
   * Inside a `QuoteCard`: in its compact density the word "Seen" gives way to
   * an eye (the word stays for a screen reader). The table keeps the sentence.
   */
  card?: boolean;
  /** "3 days ago", or null when the customer has never opened it. */
  seenLabel: string | null;
}) {
  const presence = useContext(PresenceContext);
  const t = useTranslations("quotes.tracking");
  const row = presence[quoteId];

  if (!row) return null;
  if (row.viewingNow) return <ViewingNow quoteId={quoteId} />;
  if (!seenLabel) return <span className="text-muted-foreground italic">{t("neverOpened")}</span>;

  if (card) {
    return (
      <span className="relative inline-flex items-center gap-1.5 text-muted-foreground">
        <Eye aria-hidden className="hidden size-3.5 group-data-[variant=compact]/card:block" />
        <span className="group-data-[variant=compact]/card:sr-only">{t("seen")}</span>
        {seenLabel}
      </span>
    );
  }

  return <span className="text-muted-foreground">{t("seenAgo", { when: seenLabel })}</span>;
}

export function OpenCount({ quoteId }: { quoteId: string }) {
  const presence = useContext(PresenceContext);
  const row = presence[quoteId];

  if (!row) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{row.openCount}</span>;
}

/**
 * The open count written out — "2 opens" — for a card, where there is no column
 * header to say what the number is. The same dash as `OpenCount` when no link
 * ever went out, for the same reason.
 */
export function OpenCountLabel({ quoteId }: { quoteId: string }) {
  const presence = useContext(PresenceContext);
  const t = useTranslations("quotes.cards");
  const row = presence[quoteId];

  if (!row) return <span>—</span>;
  return <span className="tabular-nums">{t("opens", { count: row.openCount })}</span>;
}
