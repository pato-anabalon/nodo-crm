import { profileSchema } from "../schemas";

describe("profileSchema", () => {
  it("stores a cleared job title and phone as null, which hides the line on the quote", () => {
    const parsed = profileSchema.parse({ name: "Rolando Reveco", jobTitle: "   ", phone: "" });
    expect(parsed.jobTitle).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  it("keeps a job title and phone, trimmed", () => {
    const parsed = profileSchema.parse({
      name: "Rolando Reveco",
      jobTitle: "  Managing Director ",
      phone: " 021 742 300 ",
    });
    expect(parsed.jobTitle).toBe("Managing Director");
    expect(parsed.phone).toBe("021 742 300");
  });

  it("refuses a job title longer than the field allows", () => {
    expect(profileSchema.safeParse({ name: "Rolando", jobTitle: "x".repeat(81) }).success).toBe(false);
  });

  it("still requires a name", () => {
    expect(profileSchema.safeParse({ name: " ", jobTitle: "Director" }).success).toBe(false);
  });
});
