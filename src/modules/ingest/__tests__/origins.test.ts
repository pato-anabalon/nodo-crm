import { corsHeaders, isOriginAllowed, normalizeOrigin, originMatches } from "../origins";

describe("normalizeOrigin", () => {
  it("leaves only protocol and host", () => {
    expect(normalizeOrigin("https://acme.co.nz/contacto?x=1")).toBe("https://acme.co.nz");
  });

  it("assumes https when no protocol is given", () => {
    expect(normalizeOrigin("acme.co.nz")).toBe("https://acme.co.nz");
  });

  it("keeps the port, which distinguishes local environments", () => {
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("returns null for unusable values", () => {
    expect(normalizeOrigin(null)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("null")).toBeNull();
  });
});

describe("originMatches", () => {
  it("accepts the exact origin", () => {
    expect(originMatches("https://acme.co.nz", "https://acme.co.nz")).toBe(true);
  });

  it("tells the protocol apart", () => {
    expect(originMatches("https://acme.co.nz", "http://acme.co.nz")).toBe(false);
  });

  it("does not confuse a domain that merely ends alike", () => {
    expect(originMatches("https://acme.co.nz", "https://noacme.co.nz")).toBe(false);
    expect(originMatches("https://acme.co.nz", "https://acme.co.nz.evil.com")).toBe(false);
  });

  it("the wildcard covers a single subdomain level", () => {
    expect(originMatches("https://*.acme.co.nz", "https://www.acme.co.nz")).toBe(true);
    expect(originMatches("https://*.acme.co.nz", "https://staging.acme.co.nz")).toBe(true);
    expect(originMatches("https://*.acme.co.nz", "https://a.b.acme.co.nz")).toBe(false);
  });

  it("the wildcard does not cover the bare domain", () => {
    expect(originMatches("https://*.acme.co.nz", "https://acme.co.nz")).toBe(false);
  });
});

describe("isOriginAllowed", () => {
  const allowed = ["https://acme.co.nz", "https://*.acme.co.nz"];

  it("accepts what is on the list", () => {
    expect(isOriginAllowed(allowed, "https://acme.co.nz")).toBe(true);
    expect(isOriginAllowed(allowed, "https://www.acme.co.nz")).toBe(true);
  });

  it("rejects any other site", () => {
    expect(isOriginAllowed(allowed, "https://evil.com")).toBe(false);
  });

  it("rejects when there is no Origin: the list does not apply there", () => {
    expect(isOriginAllowed(allowed, null)).toBe(false);
  });

  it("an empty list lets nothing through", () => {
    expect(isOriginAllowed([], "https://acme.co.nz")).toBe(false);
  });
});

describe("corsHeaders", () => {
  it("answers the specific origin, never a wildcard", () => {
    const headers = corsHeaders("https://acme.co.nz");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://acme.co.nz");
    expect(headers["Access-Control-Allow-Origin"]).not.toBe("*");
    expect(headers.Vary).toBe("Origin");
  });

  it("emits no headers when there is no origin", () => {
    expect(corsHeaders(null)).toEqual({});
  });
});
