/**
 * A brake on the open notifications.
 *
 * A customer might open the quote ten times while going through it with their
 * partner. Notifying on each one turns the notification into noise and the team
 * stops looking at them, so only the first of each day is sent.
 */
export function shouldNotifyOpen(
  previousOpens: Array<{ createdAt: Date }>,
  now: Date = new Date(),
): boolean {
  if (previousOpens.length === 0) return true;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  return !previousOpens.some((open) => open.createdAt.getTime() >= startOfToday.getTime());
}
