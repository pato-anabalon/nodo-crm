import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { languageToLocale } from "@/i18n/config";
import { deadTokens, EXPO_BATCH, EXPO_PUSH_URL, expoMessages, type ExpoMessage } from "./push-messages";

/**
 * The bell's third doorway, after the bell itself and the email: a push to
 * every phone the person is signed in on. Raised by `notify` for every notice
 * it actually creates, so every kind that reaches the bell reaches the phone,
 * under the same opt-out — there is no list of kinds to keep in step.
 *
 * Never on the way of the response (`after()`), and never an error anybody
 * sees: a push that fails is a notice that is still in the bell.
 */

export type RaisedNotice = {
  id: string;
  companyId: string;
  userId: string;
  kind: string;
  params: Record<string, string | number>;
  href: string | null;
};

export function queuePush(notice: RaisedNotice): void {
  const run = () => sendPush(notice).catch((error) => console.error("Push failed", error));
  try {
    after(run);
  } catch {
    // Outside a request — a script — there is no response to wait behind.
    void run();
  }
}

export async function sendPush(notice: RaisedNotice, now: Date = new Date()): Promise<void> {
  const devices = await prisma.pushDevice.findMany({
    where: { session: { userId: notice.userId, revokedAt: null, expiresAt: { gt: now } } },
    select: { expoToken: true },
  });
  if (devices.length === 0) return;

  const [user, company, badge] = await Promise.all([
    prisma.user.findUnique({ where: { id: notice.userId }, select: { language: true } }),
    prisma.company.findUnique({ where: { id: notice.companyId }, select: { name: true, slug: true, defaultLanguage: true } }),
    prisma.notification.count({ where: { userId: notice.userId, readAt: null } }),
  ]);
  if (!company) return;

  // The same sentence the bell shows, in the recipient's language: a notice
  // stores its kind and parameters, and is worded when it is read.
  const locale = languageToLocale(user?.language ?? company.defaultLanguage);
  const t = await getTranslations({ locale, namespace: "notifications.inApp" });
  const messages = expoMessages(
    devices.map((device) => device.expoToken),
    {
      notificationId: notice.id,
      kind: notice.kind,
      href: notice.href,
      companySlug: company.slug,
      title: company.name,
      body: t(notice.kind, notice.params as Record<string, string>),
      badge,
    },
  );

  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    await deliver(messages.slice(i, i + EXPO_BATCH));
  }
}

async function deliver(messages: ExpoMessage[]): Promise<void> {
  const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  // Optional until push security is switched on in the Expo project; then every send needs it.
  if (process.env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  const response = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(messages) });
  const dead = deadTokens(messages, await response.json().catch(() => null));
  if (dead.length > 0) await prisma.pushDevice.deleteMany({ where: { expoToken: { in: dead } } });
}
