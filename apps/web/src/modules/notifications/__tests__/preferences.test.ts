import { NotificationKind } from "@/generated/prisma/enums";
import {
  NOTIFICATION_KINDS,
  isNotificationKind,
  preferenceMap,
  wantsNotice,
} from "../preferences";

describe("wantsNotice", () => {
  it("sends it when nothing has been set: absence means opted in", () => {
    expect(wantsNotice([], NotificationKind.LEAD_RECEIVED)).toBe(true);
  });

  it("respects an explicit opt-out", () => {
    const stored = [{ kind: NotificationKind.LEAD_RECEIVED, enabled: false }];
    expect(wantsNotice(stored, NotificationKind.LEAD_RECEIVED)).toBe(false);
  });

  it("turning one off doesn't turn off the rest", () => {
    const stored = [{ kind: NotificationKind.QUOTE_OPENED, enabled: false }];
    expect(wantsNotice(stored, NotificationKind.QUOTE_OPENED)).toBe(false);
    expect(wantsNotice(stored, NotificationKind.QUOTE_DECIDED)).toBe(true);
  });

  it("an explicit opt-in behaves like the default", () => {
    const stored = [{ kind: NotificationKind.CLIENT_MESSAGE, enabled: true }];
    expect(wantsNotice(stored, NotificationKind.CLIENT_MESSAGE)).toBe(true);
  });

  it("a new kind of notice reaches people who signed up before it existed", () => {
    // Their stored rows say nothing about it, and absence means send.
    const stored = [{ kind: NotificationKind.LEAD_RECEIVED, enabled: false }];
    expect(wantsNotice(stored, NotificationKind.CLIENT_MESSAGE)).toBe(true);
  });
});

describe("preferenceMap", () => {
  it("fills in the unset kinds as on", () => {
    const map = preferenceMap([{ kind: NotificationKind.QUOTE_OPENED, enabled: false }]);

    expect(map[NotificationKind.QUOTE_OPENED]).toBe(false);
    expect(map[NotificationKind.LEAD_RECEIVED]).toBe(true);
    expect(Object.keys(map)).toHaveLength(NOTIFICATION_KINDS.length);
  });

  it("covers every kind in the enum", () => {
    const map = preferenceMap([]);
    for (const kind of Object.values(NotificationKind)) {
      expect(map[kind]).toBe(true);
    }
  });
});

describe("isNotificationKind", () => {
  it("accepts the real kinds and rejects invented ones", () => {
    expect(isNotificationKind("LEAD_RECEIVED")).toBe(true);
    expect(isNotificationKind("EVERYTHING")).toBe(false);
  });
});
