/**
 * A notice's `href` is the web's path, written once on the server for both
 * apps. This turns it into the screen the app has for it, or null when the
 * thing lives only on the web (a lead, a quote) and the bell is where to stay.
 * Pure, so every shape the server writes is checked without a phone.
 */
const ROUTES: [RegExp, (...ids: string[]) => string][] = [
  [/^\/jobs\/([^/]+)\/todos\/lists\/[^/]+$/, (job) => `/jobs/${job}/todos`],
  [/^\/jobs\/[^/]+\/todos\/([^/]+)$/, (todo) => `/todos/${todo}`],
  [/^\/jobs\/([^/]+)\/todos$/, (job) => `/jobs/${job}/todos`],
  [/^\/jobs\/[^/]+\/messages\/([^/]+)$/, (post) => `/posts/${post}`],
  [/^\/jobs\/([^/]+)\/messages$/, (job) => `/jobs/${job}/board`],
  [/^\/jobs\/[^/]+\/confidential\/([^/]+)$/, (post) => `/posts/${post}`],
  [/^\/jobs\/([^/]+)\/confidential$/, (job) => `/jobs/${job}/confidential`],
  [/^\/jobs\/([^/]+)\/chat$/, (job) => `/jobs/${job}/chat`],
  // An event has no screen of its own in the app; its job's agenda does.
  [/^\/jobs\/([^/]+)\/schedule(?:\/[^/]+)?$/, (job) => `/jobs/${job}/schedule`],
  [/^\/jobs\/([^/]+)\/docs(?:\/.*)?$/, (job) => `/jobs/${job}/files`],
  [/^\/jobs\/([^/]+)$/, (job) => `/jobs/${job}`],
  [/^\/jobs$/, () => "/"],
];

export function appHref(href: string | null | undefined): string | null {
  if (!href?.startsWith("/")) return null;
  const path = href.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  for (const [pattern, to] of ROUTES) {
    const match = path.match(pattern);
    if (match) return to(...match.slice(1).map(decodeURIComponent));
  }
  return null;
}
