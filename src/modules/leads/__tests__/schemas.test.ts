import { LeadSource, LeadStatus } from "@/generated/prisma/enums";
import { leadFiltersSchema, leadFormDataToInput, leadFormSchema } from "../schemas";
import { isClosedStatus, leadStatusVariant, LEAD_SOURCES } from "../constants";

function formDataFrom(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.append(key, value);
  return fd;
}

describe("leadFormSchema", () => {
  it("turns the form's empty fields into null", () => {
    const fd = formDataFrom({
      title: "Implementación de red",
      description: "",
      status: LeadStatus.NEW,
      source: LeadSource.WEB,
      score: "0",
      estimatedValue: "",
      contactEmail: "",
      companyName: "",
    });

    const result = leadFormSchema.safeParse(leadFormDataToInput(fd));
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.description).toBeNull();
    expect(result.data.estimatedValue).toBeNull();
    expect(result.data.contactEmail).toBeNull();
  });

  it("requires a title that says something", () => {
    const result = leadFormSchema.safeParse({ title: "ab" });
    expect(result.success).toBe(false);
  });

  it("validates the email only when it arrives with content", () => {
    const base = { title: "Oportunidad válida" };
    expect(leadFormSchema.safeParse({ ...base, contactEmail: "" }).success).toBe(true);
    expect(leadFormSchema.safeParse({ ...base, contactEmail: "no-es-correo" }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...base, contactEmail: "ok@empresa.cl" }).success).toBe(true);
  });

  it("clamps the score to the 0-100 range", () => {
    const base = { title: "Oportunidad válida" };
    expect(leadFormSchema.safeParse({ ...base, score: 101 }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...base, score: -1 }).success).toBe(false);
    expect(leadFormSchema.safeParse({ ...base, score: 100 }).success).toBe(true);
  });

  it("rejects a negative estimated value", () => {
    const result = leadFormSchema.safeParse({ title: "Oportunidad válida", estimatedValue: -5 });
    expect(result.success).toBe(false);
  });

  it("carries the picked contact's id through, and reads it back as null when nothing was picked", () => {
    const picked = leadFormDataToInput(
      formDataFrom({ title: "Oportunidad válida", contactId: "contact_1" }),
    );
    expect(leadFormSchema.parse(picked).contactId).toBe("contact_1");

    // The combobox always posts its hidden field, empty string when nothing
    // is picked — the same shape `SearchCombobox` renders for every nullable
    // field it backs.
    const unpicked = leadFormDataToInput(
      formDataFrom({ title: "Oportunidad válida", contactId: "" }),
    );
    expect(leadFormSchema.parse(unpicked).contactId).toBeNull();
  });
});

describe("leadFiltersSchema", () => {
  it("uses page 1 by default", () => {
    expect(leadFiltersSchema.parse({}).page).toBe(1);
  });

  it("discards statuses that do not exist", () => {
    expect(leadFiltersSchema.safeParse({ status: "INVENTADO" }).success).toBe(false);
  });
});

describe("lead sources", () => {
  it("lists every one from the enum, without repeats", () => {
    expect([...LEAD_SOURCES].sort()).toEqual(Object.values(LeadSource).sort());
  });
});

describe("lead statuses", () => {
  it("recognises the closing statuses", () => {
    expect(isClosedStatus(LeadStatus.WON)).toBe(true);
    expect(isClosedStatus(LeadStatus.LOST)).toBe(true);
    expect(isClosedStatus(LeadStatus.NEGOTIATION)).toBe(false);
  });

  it("highlights won and flags lost", () => {
    expect(leadStatusVariant(LeadStatus.WON)).toBe("default");
    expect(leadStatusVariant(LeadStatus.LOST)).toBe("destructive");
  });
});
