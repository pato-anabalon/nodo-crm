/**
 * The pure half of push: what goes to Expo's push service and what its answer
 * says about each phone. Kept apart from the sending so it can be checked
 * without a network or a database.
 */

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** The most messages Expo takes in one request. */
export const EXPO_BATCH = 100;

/** `ExponentPushToken[…]` or `ExpoPushToken[…]`: anything else isn't one, and Expo would refuse it. */
export function isExpoPushToken(value: string): boolean {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/.test(value);
}

export type PushNotice = {
  notificationId: string;
  kind: string;
  href: string | null;
  companySlug: string;
  title: string;
  body: string;
  /** What the app's icon says: everything unread, in every company. */
  badge: number;
};

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  badge: number;
  /** What the app opens on a tap: the company to switch to, and the notice itself. */
  data: { notificationId: string; kind: string; href: string | null; companySlug: string };
};

export function expoMessages(tokens: string[], notice: PushNotice): ExpoMessage[] {
  return tokens.map((to) => ({
    to,
    title: notice.title,
    body: notice.body,
    sound: "default",
    badge: notice.badge,
    data: { notificationId: notice.notificationId, kind: notice.kind, href: notice.href, companySlug: notice.companySlug },
  }));
}

type Ticket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

/**
 * The tokens Expo says no longer reach a phone — the app was uninstalled, or
 * the token was rotated. Tickets come back in the order the messages went, so
 * they are matched by position. Anything else that failed is left alone: a
 * rate limit or an outage is not a reason to forget a phone.
 */
export function deadTokens(sent: { to: string }[], response: unknown): string[] {
  const tickets = (response as { data?: Ticket[] } | null)?.data;
  if (!Array.isArray(tickets)) return [];
  return tickets.flatMap((ticket, index) =>
    ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered" && sent[index] ? [sent[index].to] : [],
  );
}
