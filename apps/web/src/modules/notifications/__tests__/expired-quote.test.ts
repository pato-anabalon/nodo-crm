/** @jest-environment node */
import { notifyExpiredQuoteOpened } from "../expired-quote";

/**
 * A customer back on a quote that ran out is somebody to ring. Pinned here:
 * who hears about it, that a day's visits are one notice, and that the email
 * only follows a notice actually raised — the opt-out governs both.
 */

jest.mock("@/lib/db/prisma", () => ({
  prisma: { quote: { findUnique: jest.fn() }, membership: { findMany: jest.fn() } },
}));
jest.mock("../inbox", () => ({ notify: jest.fn() }));
jest.mock("../email-notice", () => ({ sendNoticeEmails: jest.fn() }));

const { prisma } = jest.requireMock<{
  prisma: { quote: { findUnique: jest.Mock }; membership: { findMany: jest.Mock } };
}>("@/lib/db/prisma");
const { notify } = jest.requireMock<{ notify: jest.Mock }>("../inbox");
const { sendNoticeEmails } = jest.requireMock<{ sendNoticeEmails: jest.Mock }>("../email-notice");

// 10 am on the 18th in Auckland, still the 17th in UTC.
const now = new Date("2026-11-17T21:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
  prisma.quote.findUnique.mockResolvedValue({
    id: "q1",
    number: 42,
    title: "Interior painting",
    companyId: "c1",
    createdById: "writer",
    validUntil: new Date("2026-11-13T00:00:00Z"),
    clientName: "Paula Rivas",
    clientEmail: "paula@example.com",
    clientPhone: null,
    lead: null,
    company: {
      id: "c1",
      name: "PlasterPro",
      slug: "plasterpro",
      quotePrefix: "COT",
      timezone: "Pacific/Auckland",
      formatLocale: "en-NZ",
      defaultLanguage: "EN_GB",
    },
  });
  prisma.membership.findMany.mockResolvedValue([{ userId: "owner" }, { userId: "writer" }, { userId: "owner" }]);
});

it("tells Owners, Admins and whoever wrote it, once a day each", async () => {
  notify.mockResolvedValue(true);
  await notifyExpiredQuoteOpened("q1", "Paula", now);

  expect(prisma.membership.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        status: "ACTIVE",
        OR: [{ role: { key: { in: ["OWNER", "ADMIN"] } } }, { userId: "writer" }],
      }),
    }),
  );
  expect(notify).toHaveBeenCalledTimes(2);
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "owner",
      kind: "QUOTE_EXPIRED_OPENED",
      params: { reference: "COT-000042", customer: "Paula" },
      dedupeKey: "quote-expired-opened:q1:2026-11-18",
    }),
  );
  expect(sendNoticeEmails).toHaveBeenCalledWith(
    expect.objectContaining({ slug: "plasterpro" }),
    expect.objectContaining({
      userIds: ["owner", "writer"],
      template: "quoteExpiredOpened",
      params: expect.objectContaining({ contact: "paula@example.com", customer: "Paula" }),
    }),
  );
});

it("emails only the people whose notice was new", async () => {
  notify.mockImplementation(async ({ userId }: { userId: string }) => userId === "writer");
  await notifyExpiredQuoteOpened("q1", "Paula", now);
  expect(sendNoticeEmails).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userIds: ["writer"] }));
});

it("sends nothing when everybody already heard today", async () => {
  notify.mockResolvedValue(false);
  await notifyExpiredQuoteOpened("q1", "Paula", now);
  expect(sendNoticeEmails).not.toHaveBeenCalled();
});
