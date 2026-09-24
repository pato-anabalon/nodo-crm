"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sends the scrolled pane back to the top when the route changes.
 *
 * The router resets the window's scroll, and the window no longer scrolls: the
 * main area does. Without this, leaving a long list halfway down drops you into
 * the middle of the next page.
 *
 * It watches the path and not the query string on purpose — changing a report's
 * period shouldn't yank the reader away from what they were looking at.
 */
export function ScrollReset({ target }: { target: string }) {
  const pathname = usePathname();

  useEffect(() => {
    document.getElementById(target)?.scrollTo({ top: 0 });
  }, [pathname, target]);

  return null;
}
