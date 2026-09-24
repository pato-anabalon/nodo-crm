import {
  buildLeadTitle,
  isHoneypotFilled,
  normalizeSubmission,
  type NormalizedSubmission,
} from "../payload";

describe("normalizeSubmission", () => {
  it("recognises the usual English field names", () => {
    const data = normalizeSubmission({
      name: "Sarah Whitmore",
      email: "Sarah@Example.CO.NZ",
      phone: "+64 21 555 0134",
      company: "Whitmore Builders",
      message: "Kitchen needs replastering",
    });

    expect(data.name).toBe("Sarah Whitmore");
    expect(data.email).toBe("sarah@example.co.nz");
    expect(data.companyName).toBe("Whitmore Builders");
    expect(data.message).toBe("Kitchen needs replastering");
  });

  it("recognises the Spanish field names", () => {
    const data = normalizeSubmission({
      nombre: "Ana Soto",
      correo: "ana@empresa.cl",
      telefono: "+56 9 1234 5678",
      empresa: "Constructora Soto",
      mensaje: "Necesito una cotización",
    });

    expect(data.name).toBe("Ana Soto");
    expect(data.email).toBe("ana@empresa.cl");
    expect(data.phone).toBe("+56 9 1234 5678");
    expect(data.companyName).toBe("Constructora Soto");
  });

  it("resolves the field name's separators the same way", () => {
    expect(normalizeSubmission({ "your-name": "A" }).name).toBe("A");
    expect(normalizeSubmission({ your_name: "B" }).name).toBe("B");
    expect(normalizeSubmission({ yourName: "C" }).name).toBe("C");
  });

  it("joins first and last name when they arrive separately", () => {
    const data = normalizeSubmission({ first_name: "Sarah", last_name: "Whitmore" });
    expect(data.name).toBe("Sarah Whitmore");
  });

  it("prefers the full-name field over the composed one", () => {
    const data = normalizeSubmission({
      name: "Sarah W.",
      first_name: "Sarah",
      last_name: "Whitmore",
    });
    expect(data.name).toBe("Sarah W.");
  });

  it("discards a badly formed email without losing the rest", () => {
    const data = normalizeSubmission({ name: "Ana", email: "no-es-correo" });
    expect(data.email).toBeNull();
    expect(data.name).toBe("Ana");
  });

  it("flattens a list of services", () => {
    const data = normalizeSubmission({ service: ["Plastering", "Painting"] });
    expect(data.serviceType).toBe("Plastering, Painting");
  });

  it("captures the campaign and the source page", () => {
    const data = normalizeSubmission({
      utm_source: "google",
      utm_campaign: "spring-2026",
      page_url: "https://plasterpro.co.nz/contact",
      referer: "https://google.com",
    });

    expect(data.utmSource).toBe("google");
    expect(data.utmCampaign).toBe("spring-2026");
    expect(data.sourceUrl).toBe("https://plasterpro.co.nz/contact");
    expect(data.referrer).toBe("https://google.com");
  });

  it("returns everything null with an empty form", () => {
    const data = normalizeSubmission({});
    expect(Object.values(data).every((v) => v === null)).toBe(true);
  });

  it("ignores nested objects instead of breaking", () => {
    const data = normalizeSubmission({ name: { first: "Ana" }, email: "ana@test.cl" });
    expect(data.name).toBeNull();
    expect(data.email).toBe("ana@test.cl");
  });
});

describe("isHoneypotFilled", () => {
  it("detects the most common honeypot fields", () => {
    expect(isHoneypotFilled({ honeypot: "spam" })).toBe(true);
    expect(isHoneypotFilled({ "bot-field": "x" })).toBe(true);
    expect(isHoneypotFilled({ _gotcha: "x" })).toBe(true);
  });

  it("does not trigger when they arrive empty, which is the normal case", () => {
    expect(isHoneypotFilled({ honeypot: "", name: "Ana" })).toBe(false);
    expect(isHoneypotFilled({ name: "Ana" })).toBe(false);
  });
});

describe("buildLeadTitle", () => {
  const empty: NormalizedSubmission = {
    name: null, email: null, phone: null, companyName: null, message: null,
    serviceType: null, address: null, sourceUrl: null, referrer: null,
    utmSource: null, utmMedium: null, utmCampaign: null,
  };

  it("combines the service and who is asking", () => {
    expect(
      buildLeadTitle({ ...empty, serviceType: "Plastering", name: "Sarah" }, "Lead"),
    ).toBe("Plastering — Sarah");
  });

  it("prefers the company over the person", () => {
    expect(
      buildLeadTitle(
        { ...empty, serviceType: "Plastering", name: "Sarah", companyName: "Whitmore Ltd" },
        "Lead",
      ),
    ).toBe("Plastering — Whitmore Ltd");
  });

  it("uses the message when there is nothing better", () => {
    expect(buildLeadTitle({ ...empty, message: "Necesito pintar la casa" }, "Lead")).toBe(
      "Necesito pintar la casa",
    );
  });

  it("trims a long message", () => {
    expect(buildLeadTitle({ ...empty, message: "x".repeat(200) }, "Lead").length).toBe(80);
  });

  it("falls back to the generic one with a form holding nothing useful", () => {
    expect(buildLeadTitle(empty, "Nuevo lead")).toBe("Nuevo lead");
  });
});
