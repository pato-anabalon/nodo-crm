import { withStrictSsl } from "../connection";

const sslmode = (url: string) => new URL(url).searchParams.get("sslmode");

describe("withStrictSsl", () => {
  const neon = "postgresql://u:p@ep-x.aws.neon.tech/db?channel_binding=require&sslmode=require";

  it("pins the mode Neon hands out to the strict one it already means", () => {
    expect(sslmode(withStrictSsl(neon))).toBe("verify-full");
  });

  it.each(["prefer", "require", "verify-ca"])("pins %s, which pg is about to weaken", (mode) => {
    expect(sslmode(withStrictSsl(`postgresql://u:p@h/db?sslmode=${mode}`))).toBe("verify-full");
  });

  it("keeps every other parameter", () => {
    const params = new URL(withStrictSsl(neon)).searchParams;
    expect(params.get("channel_binding")).toBe("require");
  });

  it("leaves a URL that already asks for verify-full untouched", () => {
    const url = "postgresql://u:p@h/db?sslmode=verify-full";
    expect(withStrictSsl(url)).toBe(url);
  });

  it("does not force TLS onto a local database that disabled it", () => {
    // A Postgres on localhost without certificates is a legitimate setup.
    const url = "postgresql://u:p@localhost:5432/db?sslmode=disable";
    expect(withStrictSsl(url)).toBe(url);
  });

  it("respects someone who opted into libpq semantics on purpose", () => {
    const url = "postgresql://u:p@h/db?uselibpqcompat=true&sslmode=require";
    expect(withStrictSsl(url)).toBe(url);
  });

  it("adds the mode when the URL carries none", () => {
    expect(sslmode(withStrictSsl("postgresql://u:p@h/db"))).toBe("verify-full");
  });

  it("hands back something unparseable rather than throwing", () => {
    expect(withStrictSsl("not a url")).toBe("not a url");
  });
});
