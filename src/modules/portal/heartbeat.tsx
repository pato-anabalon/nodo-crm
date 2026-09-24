"use client";

import { useEffect, useRef } from "react";
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
 */
export function PresenceHeartbeat({ token }: { token: string }) {
  const opened = useRef(false);

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
      }).catch(() => undefined);
    };

    ping();
    const timer = setInterval(ping, HEARTBEAT_SECONDS * 1000);
    document.addEventListener("visibilitychange", ping);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [token]);

  return null;
}
