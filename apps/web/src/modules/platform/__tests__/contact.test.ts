import { platformContactEmail } from "../contact";

describe("platformContactEmail", () => {
  const original = process.env.PLATFORM_CONTACT_EMAIL;
  afterEach(() => {
    if (original === undefined) delete process.env.PLATFORM_CONTACT_EMAIL;
    else process.env.PLATFORM_CONTACT_EMAIL = original;
  });

  it("returns the address when it is one", () => {
    process.env.PLATFORM_CONTACT_EMAIL = " hello@nodo.co.nz ";
    expect(platformContactEmail()).toBe("hello@nodo.co.nz");
  });

  it("is null when unset, so the email carries no reply-to and the button goes to the site", () => {
    delete process.env.PLATFORM_CONTACT_EMAIL;
    expect(platformContactEmail()).toBeNull();
  });

  it.each(["", "not-an-address", "a@b", "two@nodo.co.nz, three@nodo.co.nz", "Name <a@nodo.co.nz>"])(
    "refuses %p rather than put it in a header",
    (value) => {
      process.env.PLATFORM_CONTACT_EMAIL = value;
      expect(platformContactEmail()).toBeNull();
    },
  );

  it("never reads the admin allowlist: the address owners see must not hint at the way into /admin", () => {
    const { readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
    const { join } = jest.requireActual<typeof import("node:path")>("node:path");
    const source = readFileSync(join(process.cwd(), "src/modules/platform/contact.ts"), "utf8");

    // The explanation may name the variable; the code must not read it.
    expect(source).not.toMatch(/process\.env\.PLATFORM_ADMIN_EMAILS/);
    expect(source).not.toMatch(/platformAdminAddresses|isPlatformAdmin/);
  });
});
