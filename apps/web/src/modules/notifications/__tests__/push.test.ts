/** @jest-environment node */
const prismaMock = {
  notificationPreference: { findMany: jest.fn() },
  notification: { create: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), count: jest.fn() },
  pushDevice: { findMany: jest.fn(), deleteMany: jest.fn() },
  user: { findUnique: jest.fn() },
  company: { findUnique: jest.fn() },
};
const getTranslations = jest.fn();
const after = jest.fn();

jest.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return prismaMock;
  },
}));
jest.mock("next-intl/server", () => ({ getTranslations: (...args: unknown[]) => getTranslations(...args) }));
jest.mock("next/server", () => ({ after: (task: () => unknown) => after(task) }));

import { notify } from "../inbox";
import { sendPush } from "../push";
import { deadTokens, expoMessages, isExpoPushToken } from "../push-messages";

/**
 * Push is the bell's third doorway: whatever `notify` raises goes to the
 * person's phones, worded in their language, and nothing it doesn't raise —
 * an opt-out or a repeat — buzzes anybody.
 */

const TOKEN = "ExponentPushToken[abcdefghijklmnop]";
const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  jest.resetAllMocks();
  prismaMock.notificationPreference.findMany.mockResolvedValue([]);
  prismaMock.notification.create.mockResolvedValue({ id: "n1" });
  prismaMock.notification.upsert.mockResolvedValue({ id: "n2" });
  prismaMock.notification.findUnique.mockResolvedValue(null);
  prismaMock.notification.count.mockResolvedValue(3);
  prismaMock.pushDevice.findMany.mockResolvedValue([{ expoToken: TOKEN }]);
  prismaMock.user.findUnique.mockResolvedValue({ language: "ES" });
  prismaMock.company.findUnique.mockResolvedValue({ name: "Acme Ltd", slug: "acme", defaultLanguage: "EN_GB" });
  getTranslations.mockResolvedValue((key: string, values: Record<string, string>) => `${key} ${values.title ?? ""}`.trim());
  fetchMock.mockResolvedValue({ json: async () => ({ data: [{ status: "ok", id: "t1" }] }) });
});

describe("notify", () => {
  const input = { companyId: "c1", userId: "u1", kind: "JOB_CHAT_MENTION" as const, params: { title: "Job" }, href: "/jobs/j1/chat" };

  it("queues a push for every notice it raises", async () => {
    expect(await notify(input)).toBe(true);
    expect(after).toHaveBeenCalledTimes(1);
    expect(await notify({ ...input, dedupeKey: "k" })).toBe(true);
    expect(after).toHaveBeenCalledTimes(2);
  });

  it("buzzes nobody for a notice turned off, or one already raised", async () => {
    prismaMock.notificationPreference.findMany.mockResolvedValueOnce([{ kind: "JOB_CHAT_MENTION", enabled: false }]);
    expect(await notify(input)).toBe(false);
    prismaMock.notification.findUnique.mockResolvedValueOnce({ id: "old" });
    expect(await notify({ ...input, dedupeKey: "k" })).toBe(false);
    expect(after).not.toHaveBeenCalled();
  });
});

describe("sendPush", () => {
  const notice = { id: "n1", companyId: "c1", userId: "u1", kind: "JOB_CHAT_MENTION", params: { title: "Job" }, href: "/jobs/j1/chat" };

  it("words the notice in the recipient's language and says where to go", async () => {
    await sendPush(notice);
    expect(getTranslations).toHaveBeenCalledWith({ locale: "es", namespace: "notifications.inApp" });
    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(request.body)).toEqual([
      {
        to: TOKEN,
        title: "Acme Ltd",
        body: "JOB_CHAT_MENTION Job",
        sound: "default",
        badge: 3,
        data: { notificationId: "n1", kind: "JOB_CHAT_MENTION", href: "/jobs/j1/chat", companySlug: "acme" },
      },
    ]);
  });

  it("only reaches phones whose session still opens", async () => {
    const now = new Date("2026-11-08T00:00:00Z");
    await sendPush(notice, now);
    expect(prismaMock.pushDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { session: { userId: "u1", revokedAt: null, expiresAt: { gt: now } } } }),
    );
  });

  it("sends nothing to somebody with no phone", async () => {
    prismaMock.pushDevice.findMany.mockResolvedValue([]);
    await sendPush(notice);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forgets a phone Expo says is gone", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }) });
    await sendPush(notice);
    expect(prismaMock.pushDevice.deleteMany).toHaveBeenCalledWith({ where: { expoToken: { in: [TOKEN] } } });
  });
});

describe("the messages", () => {
  it("knows an Expo token from anything else", () => {
    expect(isExpoPushToken(TOKEN)).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abcdefghijklmnop]")).toBe(true);
    expect(isExpoPushToken("fcm:abcdefghijklmnop")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
  });

  it("matches tickets to tokens by position and forgets only the unregistered", () => {
    const sent = expoMessages(["a", "b", "c"], {
      notificationId: "n",
      kind: "k",
      href: null,
      companySlug: "acme",
      title: "t",
      body: "b",
      badge: 0,
    });
    const response = {
      data: [
        { status: "ok", id: "1" },
        { status: "error", details: { error: "DeviceNotRegistered" } },
        { status: "error", details: { error: "MessageRateExceeded" } },
      ],
    };
    expect(deadTokens(sent, response)).toEqual(["b"]);
    expect(deadTokens(sent, null)).toEqual([]);
  });
});
