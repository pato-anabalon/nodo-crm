import {
  addExtraRecipient,
  MAX_EXTRA_RECIPIENTS,
  normaliseAddress,
  removeExtraRecipient,
  withoutStaff,
} from "../extra-recipients";

describe("addExtraRecipient", () => {
  it("adds an address", () => {
    expect(addExtraRecipient([], "regan@plasterpro.co.nz")).toEqual({
      ok: true,
      list: ["regan@plasterpro.co.nz"],
    });
  });

  it("stores it the way everything else stores addresses", () => {
    const result = addExtraRecipient([], "  Regan@PlasterPro.CO.NZ ");
    expect(result).toEqual({ ok: true, list: ["regan@plasterpro.co.nz"] });
  });

  it.each(["", "   ", "regan", "regan@", "@plasterpro.co.nz", "regan plasterpro.co.nz"])(
    "refuses %p",
    (value) => {
      // Caught here rather than discovered when the notice stops arriving.
      expect(addExtraRecipient([], value)).toEqual({ ok: false, reason: "invalid" });
    },
  );

  it("refuses the same address twice, whatever the capitalisation", () => {
    expect(addExtraRecipient(["regan@plasterpro.co.nz"], "REGAN@plasterpro.co.nz")).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("stops at the limit", () => {
    const full = Array.from({ length: MAX_EXTRA_RECIPIENTS }, (_, i) => `a${i}@test.co.nz`);
    expect(addExtraRecipient(full, "one.more@test.co.nz")).toEqual({ ok: false, reason: "full" });
  });

  it("leaves the list it was given untouched", () => {
    const original = ["a@test.co.nz"];
    addExtraRecipient(original, "b@test.co.nz");
    expect(original).toEqual(["a@test.co.nz"]);
  });
});

describe("removeExtraRecipient", () => {
  it("removes the one asked for", () => {
    expect(removeExtraRecipient(["a@test.co.nz", "b@test.co.nz"], "a@test.co.nz")).toEqual([
      "b@test.co.nz",
    ]);
  });

  it("matches however it was typed", () => {
    expect(removeExtraRecipient(["a@test.co.nz"], " A@TEST.co.nz ")).toEqual([]);
  });

  it("does nothing when it isn't there", () => {
    expect(removeExtraRecipient(["a@test.co.nz"], "z@test.co.nz")).toEqual(["a@test.co.nz"]);
  });
});

describe("withoutStaff", () => {
  it("drops an address the team already receives", () => {
    // The same lead arriving twice is how people start ignoring the notice.
    expect(withoutStaff(["ana@acme.test", "office@acme.test"], ["Ana@Acme.test"])).toEqual([
      "office@acme.test",
    ]);
  });

  it("keeps everything when nobody overlaps", () => {
    expect(withoutStaff(["office@acme.test"], ["ana@acme.test"])).toEqual(["office@acme.test"]);
  });

  it("copes with no team recipients at all", () => {
    expect(withoutStaff(["office@acme.test"], [])).toEqual(["office@acme.test"]);
  });
});

describe("normaliseAddress", () => {
  it("trims and lowercases", () => {
    expect(normaliseAddress("  A@B.test ")).toBe("a@b.test");
  });
});
