import { avatarPathname } from "../avatar";

describe("avatarPathname", () => {
  it("files the avatar under the user's own id, not a company's", () => {
    expect(avatarPathname("usr_1", "image/png")).toBe("users/usr_1/avatar.png");
  });

  it("takes the extension from the type, not from the uploaded name", () => {
    expect(avatarPathname("usr_1", "image/webp")).toBe("users/usr_1/avatar.webp");
    expect(avatarPathname("usr_1", "image/jpeg")).toBe("users/usr_1/avatar.jpg");
  });
});
