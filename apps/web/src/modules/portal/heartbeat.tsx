"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { HEARTBEAT_SECONDS } from "./share";

/**
 * Signals every few seconds that the customer still has the quote open.
 *
 * It stops when the tab goes to the background: if nobody is looking at it, the
 * company's panel shouldn't claim otherwise.
 *
 * **The first beat is also what records the opening.** It used to be the page
 * render, and a render is not a visit: every action in the portal revalidates
 * the page, so accepting a quote or sending a message logged an "opened the
 * quote" that never happened and bumped the counter the company reads. A beat
 * comes from a browser that has the page in front of somebody.
 *
 * **The last beat says so.** Closing the tab used to look exactly like a
 * heartbeat gone quiet for a few seconds, so the panel kept reading "viewing
 * now" until the whole presence window ran out — which read as fake in a demo,
 * closing the customer's tab and having the panel insist for another half
 * minute that they were still there. `pagehide` fires as the page is actually
 * torn down, and `sendBeacon` is what a browser still delivers at that moment —
 * a `fetch`, even `keepalive`, isn't guaranteed to survive it.
 *
 * **Each beat also hears the quote's revision.** Somebody on the team saving a
 * change bumps it, and a page drawn from an older one says so — it doesn't
 * reload by itself, because the customer may be halfway through signing, and
 * accepting the old version is refused on the server anyway.
 */
export function PresenceHeartbeat({ token, revision }: { token: string; revision?: number }) {
  const opened = useRef(false);
  const [newer, setNewer] = useState(false);

  useEffect(() => {
    const url = `/api/q/${encodeURIComponent(token)}/ping`;

    const ping = () => {
      // A tab opened in the background has not been looked at yet, so the
      // opening waits rather than being recorded and then contradicted.
      if (document.visibilityState !== "visible") return;

      const first = !opened.current;
      opened.current = true;
      void fetch(first ? `${url}?first=1` : url, {
        method: "POST",
        keepalive: true,
      })
        .then(async (response) => {
          if (revision === undefined || response.status !== 200) return;
          const body = (await response.json()) as { revision?: unknown };
          if (typeof body.revision === "number" && body.revision > revision) setNewer(true);
        })
        .catch(() => undefined);
    };

    const leave = () => {
      // Nothing was ever recorded as watched, so there's nothing to retract.
      if (!opened.current) return;
      navigator.sendBeacon?.(`${url}?leaving=1`);
    };

    ping();
    const timer = setInterval(ping, HEARTBEAT_SECONDS * 1000);
    document.addEventListener("visibilitychange", ping);
    window.addEventListener("pagehide", leave);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
      window.removeEventListener("pagehide", leave);
    };
  }, [token, revision]);

  return newer ? <QuoteUpdatedBanner /> : null;
}

/** Over the page, not instead of it: what they were reading stays where it was until they choose. */
function QuoteUpdatedBanner() {
  const t = useTranslations("portal.updated");
  return (
    <div
      role="status"
      className="no-print sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-primary px-4 py-3 text-sm text-primary-foreground"
    >
      <span className="font-medium">{t("title")}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary-foreground px-3 py-1 font-medium text-primary"
      >
        {t("reload")}
      </button>
    </div>
  );
}
