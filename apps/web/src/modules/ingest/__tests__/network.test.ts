import { isPublicAddress } from "../network";

describe("isPublicAddress", () => {
  it("accepts public addresses", () => {
    expect(isPublicAddress("76.76.21.21")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("refuses loopback, private and link-local ranges", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.33",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
    ]) {
      expect(isPublicAddress(address)).toBe(false);
    }
  });

  it("judges IPv4-mapped IPv6 as the IPv4 it carries", () => {
    expect(isPublicAddress("::ffff:10.0.0.1")).toBe(false);
    expect(isPublicAddress("::ffff:76.76.21.21")).toBe(true);
  });

  it("refuses anything that isn't an IP", () => {
    expect(isPublicAddress("localhost")).toBe(false);
  });
});
