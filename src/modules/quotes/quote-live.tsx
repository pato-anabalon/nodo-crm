"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { MessageThread } from "@/modules/portal/message-thread";
import { threadChanged, type ThreadMessage } from "@/modules/portal/thread";
import type { LiveFeed } from "./live";

type LiveValue = {
  presence: LiveFeed["presence"];
  /** `null` until the first poll answers: the thread shows what the server
   * rendered until then. */
  messages: ThreadMessage[] | null;
  refresh: () => Promise<void>;
};

const LiveContext = createContext<LiveValue | null>(null);

export function useQuoteLive(): LiveValue | null {
  return useContext(LiveContext);
}

/**
 * The one poll an open quote makes.
 *
 * `QuoteTracking` and the message thread sit in different corners of the page
 * and used to poll on their own, side by side, at the same 10s. Both now read
 * from here, which asks `/api/quotes/<id>/live` once per tick.
 *
 * How often comes from the server — on first render and again with every
 * answer — so it slows down once the quote is decided and stops once the link
 * is closed, including when that happens while the page is open.
 */
export function QuoteLive({
  quoteId,
  initialPresence,
  pollSeconds: renderedPollSeconds,
  children,
}: {
  quoteId: string;
  initialPresence: LiveFeed["presence"];
  pollSeconds: number | null;
  children: ReactNode;
}) {
  const [presence, setPresence] = useState(initialPresence);
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [pollSeconds, setPollSeconds] = useState(renderedPollSeconds);

  // A revalidation after revoking or resending renders a new cadence; it wins
  // over whatever the last poll said, being the more recent of the two.
  const [seenRendered, setSeenRendered] = useState(renderedPollSeconds);
  if (seenRendered !== renderedPollSeconds) {
    setSeenRendered(renderedPollSeconds);
    setPollSeconds(renderedPollSeconds);
  }

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/live`);
      if (!response.ok) return;
      const feed = (await response.json()) as LiveFeed;
      setPresence(feed.presence);
      // Only swap when something actually arrived: replacing the array on
      // every poll would restart any text selection inside the thread.
      setMessages((current) =>
        current && !threadChanged(current, feed.messages) ? current : feed.messages,
      );
      setPollSeconds(feed.pollSeconds);
    } catch {
      // A failed poll isn't worth reporting: the next one is seconds away and
      // what's already on screen is still valid.
    }
  }, [quoteId]);

  useEffect(() => {
    if (pollSeconds === null) return;

    const tick = () => {
      // Nobody is reading a tab that isn't on screen; coming back to it asks
      // straight away rather than at the next tick.
      if (document.visibilityState === "visible") void refresh();
    };

    const timer = setInterval(tick, pollSeconds * 1000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [pollSeconds, refresh]);

  return (
    <LiveContext.Provider value={{ presence, messages, refresh }}>{children}</LiveContext.Provider>
  );
}

/**
 * The team's side of the thread, fed by `QuoteLive` rather than by a poll of
 * its own. The customer's side still polls on its own (`feedUrl`): the portal
 * has no presence to fold in, so there is nothing to merge it with.
 */
export function QuoteLiveThread(props: Omit<ComponentProps<typeof MessageThread>, "feedUrl" | "live">) {
  const live = useQuoteLive();
  if (!live) throw new Error("QuoteLiveThread must be rendered inside <QuoteLive>");
  return <MessageThread {...props} live={{ messages: live.messages, refresh: live.refresh }} />;
}
