import { ApiError, toApiError } from "../api";
import { errorKey } from "../errors";
import { formatDay } from "../format";
import { deviceLocale } from "../i18n";
import { markRead } from "../inbox";
import { pickCompany } from "../session-rules";
import type { CompanyChoice, Inbox } from "../types";

const company = (slug: string): CompanyChoice => ({ slug, name: slug, logoUrl: null, primaryColor: "#2563eb" });

describe("the server's refusals", () => {
  it("keep their code, their fields and anything else they carry", () => {
    const error = toApiError(422, { error: "invalid", fields: { email: ["validation.invalidEmail"] } });
    expect(error).toMatchObject({ status: 422, code: "invalid", fields: { email: ["validation.invalidEmail"] } });
    expect(toApiError(401, { error: "invalid_code", remaining: 2 }).extra).toEqual({ remaining: 2 });
  });

  it("are a server error when the body says nothing", () => {
    expect(toApiError(502, null).code).toBe("server_error");
    expect(toApiError(404, "<html>").code).toBe("unknown");
  });

  it("have words only for the codes the app knows", () => {
    expect(errorKey(new ApiError(401, "invalid_credentials"))).toBe("invalid_credentials");
    expect(errorKey(new ApiError(0, "network"))).toBe("network");
    expect(errorKey(new ApiError(500, "server_error"))).toBe("generic");
    expect(errorKey(new Error("boom"))).toBe("generic");
  });
});

describe("the company the app opens in", () => {
  it("is the one last chosen, while this person still works there", () => {
    expect(pickCompany([company("acme"), company("plaster")], "plaster")).toBe("plaster");
  });

  it("is the only one when there is one, even if another was stored", () => {
    expect(pickCompany([company("acme")], "gone")).toBe("acme");
  });

  it("is chosen by the person when there are several and the stored one ended", () => {
    expect(pickCompany([company("acme"), company("plaster")], "gone")).toBeNull();
    expect(pickCompany([], null)).toBeNull();
  });
});

describe("the bell, pressed", () => {
  const inbox: Inbox = {
    unread: 2,
    items: [
      { id: "a", kind: "JOB_POST", params: {}, href: null, read: false, createdAt: "2026-11-08T00:00:00Z" },
      { id: "b", kind: "JOB_POST", params: {}, href: null, read: true, createdAt: "2026-11-08T00:00:00Z" },
      { id: "c", kind: "JOB_POST", params: {}, href: null, read: false, createdAt: "2026-11-08T00:00:00Z" },
    ],
  };

  it("reads one and counts one down", () => {
    const after = markRead(inbox, "a");
    expect(after.unread).toBe(1);
    expect(after.items.map((item) => item.read)).toEqual([true, true, false]);
  });

  it("doesn't count down for one that was already read", () => {
    expect(markRead(inbox, "b").unread).toBe(2);
  });

  it("reads them all", () => {
    expect(markRead(inbox, "all")).toMatchObject({ unread: 0 });
  });
});

describe("before anybody has signed in", () => {
  it("speaks the phone's language when it is one of ours", () => {
    expect(deviceLocale(["es"])).toBe("es");
    expect(deviceLocale(["en"])).toBe("en-GB");
    expect(deviceLocale(["fr"])).toBe("en-GB");
    expect(deviceLocale([])).toBe("en-GB");
  });
});

it("draws a day as the company's calendar day, whatever the phone's zone", () => {
  expect(formatDay("2026-01-31", "en-NZ")).toBe("31 Jan");
});
