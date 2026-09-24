import { companySlugFromHost, companyUrl, isValidSlug } from "../host";

const ROOT = "nodo-crm.app";

describe("companySlugFromHost", () => {
  it("extracts the slug from a subdomain", () => {
    expect(companySlugFromHost("acme.nodo-crm.app", ROOT)).toBe("acme");
  });

  it("ignores the port and the casing", () => {
    expect(companySlugFromHost("ACME.localhost:3000", "localhost:3000")).toBe("acme");
  });

  it("returns null on the root domain", () => {
    expect(companySlugFromHost("nodo-crm.app", ROOT)).toBeNull();
    expect(companySlugFromHost("localhost:3000", "localhost:3000")).toBeNull();
  });

  it("returns null for reserved subdomains", () => {
    expect(companySlugFromHost("www.nodo-crm.app", ROOT)).toBeNull();
    expect(companySlugFromHost("api.nodo-crm.app", ROOT)).toBeNull();
    expect(companySlugFromHost("admin.nodo-crm.app", ROOT)).toBeNull();
  });

  it("does not accept nested subdomains", () => {
    expect(companySlugFromHost("a.b.nodo-crm.app", ROOT)).toBeNull();
  });

  it("ignores hosts from another domain", () => {
    expect(companySlugFromHost("acme.otrositio.com", ROOT)).toBeNull();
  });

  it("returns null on Vercel preview URLs", () => {
    expect(companySlugFromHost("nodo-crm-git-main.vercel.app", ROOT)).toBeNull();
  });

  it("tolerates an empty or absent host", () => {
    expect(companySlugFromHost(null, ROOT)).toBeNull();
    expect(companySlugFromHost("", ROOT)).toBeNull();
  });

  it("rejects slugs with invalid characters", () => {
    expect(companySlugFromHost("acme_corp.nodo-crm.app", ROOT)).toBeNull();
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase, digits and internal hyphens", () => {
    expect(isValidSlug("acme")).toBe(true);
    expect(isValidSlug("acme-2024")).toBe(true);
  });

  it("rejects hyphen at either end, double hyphens and uppercase", () => {
    expect(isValidSlug("-acme")).toBe(false);
    expect(isValidSlug("acme-")).toBe(false);
    expect(isValidSlug("ac--me")).toBe(false);
    expect(isValidSlug("Acme")).toBe(false);
  });
});

describe("companyUrl", () => {
  it("uses https in production and http locally", () => {
    expect(companyUrl("acme", "/leads", ROOT)).toBe("https://acme.nodo-crm.app/leads");
    expect(companyUrl("acme", "/", "localhost:3000")).toBe("http://acme.localhost:3000/");
  });
});
