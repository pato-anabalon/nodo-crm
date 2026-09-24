import { humanise, readableEntries } from "../lead-submission";

describe("humanise", () => {
  it("turns technical keys into readable labels", () => {
    expect(humanise("preferred_contact")).toBe("Preferred contact");
    expect(humanise("serviceType")).toBe("Service type");
    expect(humanise("job-address")).toBe("Job address");
  });

  it("does not break on a single-word key", () => {
    expect(humanise("suburb")).toBe("Suburb");
  });
});

describe("readableEntries", () => {
  it("omits the fields already shown in the lead's header", () => {
    const entries = readableEntries({
      name: "Paula",
      email: "paula@test.nz",
      suburb: "Ponsonby",
    });

    expect(entries).toEqual([["suburb", "Ponsonby"]]);
  });

  it("hides the form's technical fields", () => {
    const entries = readableEntries({
      "g-recaptcha-response": "abc",
      honeypot: "",
      token: "secreto",
      budget: "5000",
    });

    expect(entries).toEqual([["budget", "5000"]]);
  });

  it("flattens lists and booleans into something showable", () => {
    const entries = readableEntries({
      services: ["Painting", "Plastering"],
      urgent: true,
      newsletter: false,
    });

    expect(entries).toEqual([
      ["services", "Painting, Plastering"],
      ["urgent", "✓"],
      ["newsletter", "✗"],
    ]);
  });

  it("discards the fields that arrived empty", () => {
    expect(readableEntries({ suburb: "   ", budget: null, notes: undefined })).toEqual([]);
  });

  it("keeps the order the form came in", () => {
    const entries = readableEntries({ zeta: "1", alfa: "2", media: "3" });
    expect(entries.map(([key]) => key)).toEqual(["zeta", "alfa", "media"]);
  });

  it("tolerates a payload that is not an object", () => {
    expect(readableEntries(null)).toEqual([]);
    expect(readableEntries("texto")).toEqual([]);
    expect(readableEntries([1, 2])).toEqual([]);
  });
});
