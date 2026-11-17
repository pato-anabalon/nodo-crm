import { sessionCookieName } from "../session-cookie";

describe("sessionCookieName", () => {
  it("keeps Auth.js's own name without a suffix, so production's sessions survive", () => {
    expect(sessionCookieName(true, undefined)).toBe("__Secure-authjs.session-token");
    expect(sessionCookieName(true, "")).toBe("__Secure-authjs.session-token");
    expect(sessionCookieName(false, undefined)).toBe("authjs.session-token");
  });

  it("gives another instance a name of its own", () => {
    expect(sessionCookieName(true, "test")).toBe("__Secure-authjs.session-token.test");
  });

  it("keeps the __Secure- prefix first, where browsers require it", () => {
    expect(sessionCookieName(true, "test").startsWith("__Secure-")).toBe(true);
  });

  it("drops characters that would break the Set-Cookie header", () => {
    expect(sessionCookieName(true, "te;st= x")).toBe("__Secure-authjs.session-token.testx");
    expect(sessionCookieName(true, ";=")).toBe("__Secure-authjs.session-token");
  });
});
