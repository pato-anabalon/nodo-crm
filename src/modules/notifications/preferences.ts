import { NotificationKind } from "@/generated/prisma/enums";

/**
 * Which notice each recipient wants.
 *
 * The rule is opt-out: a row only exists once someone turns something off, so an
 * absent preference means "send it". That keeps invitations from having to seed
 * rows, and means adding a new kind of notice later doesn't silently exclude
 * everyone who signed up before it existed.
 */

/**
 * Every kind, in the order the settings screen lists them.
 *
 * A test asserts this covers the whole enum: a notice somebody can receive and
 * cannot turn off is not a setting, it's a leak.
 */
export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  NotificationKind.LEAD_RECEIVED,
  NotificationKind.LEAD_ASSIGNED,
  NotificationKind.QUOTE_OPENED,
  NotificationKind.QUOTE_DECIDED,
  NotificationKind.CLIENT_MESSAGE,
  NotificationKind.TASK_ASSIGNED,
  NotificationKind.TASK_DUE,
  NotificationKind.QUOTE_EXPIRING,
  NotificationKind.INGEST_FAILING,
];

export type PreferenceRow = { kind: NotificationKind; enabled: boolean };

/** Pure decision, so the opt-out rule can be tested without a database. */
export function wantsNotice(
  preferences: PreferenceRow[],
  kind: NotificationKind,
): boolean {
  const stored = preferences.find((preference) => preference.kind === kind);
  return stored ? stored.enabled : true;
}

/** The full set for the settings screen, filling in the unset ones as on. */
export function preferenceMap(preferences: PreferenceRow[]): Record<NotificationKind, boolean> {
  const map = {} as Record<NotificationKind, boolean>;
  for (const kind of NOTIFICATION_KINDS) map[kind] = wantsNotice(preferences, kind);
  return map;
}

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}
