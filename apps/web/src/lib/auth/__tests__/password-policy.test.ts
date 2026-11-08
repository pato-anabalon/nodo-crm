import { meetsPasswordPolicy, passwordRuleResults, passwordsReady } from "../password-policy";

describe("meetsPasswordPolicy", () => {
  it("rejects a password missing any one rule", () => {
    expect(meetsPasswordPolicy("short1A")).toBe(false); // too short
    expect(meetsPasswordPolicy("alllowercase1")).toBe(false); // no uppercase
    expect(meetsPasswordPolicy("ALLUPPERCASE1")).toBe(false); // no lowercase
    expect(meetsPasswordPolicy("NoNumberHere")).toBe(false); // no number
  });

  it("accepts a password meeting every rule", () => {
    expect(meetsPasswordPolicy("Str0ngPass")).toBe(true);
  });
});

describe("passwordRuleResults", () => {
  it("reports each rule's own pass/fail, not just the overall verdict", () => {
    expect(passwordRuleResults("abc")).toEqual([
      { id: "minLength", met: false },
      { id: "uppercase", met: false },
      { id: "lowercase", met: true },
      { id: "number", met: false },
    ]);
  });

  it("marks every rule met once the password satisfies all of them", () => {
    const results = passwordRuleResults("Str0ngPass");
    expect(results.every((r) => r.met)).toBe(true);
  });
});

describe("passwordsReady", () => {
  it("rejects a strong password whose confirmation doesn't match", () => {
    expect(passwordsReady("Str0ngPass", "Str0ngPas5")).toBe(false);
  });

  it("rejects a matching pair that's too weak", () => {
    expect(passwordsReady("weakweak", "weakweak")).toBe(false);
  });

  it("accepts a strong, matching pair", () => {
    expect(passwordsReady("Str0ngPass", "Str0ngPass")).toBe(true);
  });
});
