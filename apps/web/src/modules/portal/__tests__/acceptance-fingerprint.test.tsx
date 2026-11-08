import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import enGB from "../../../../messages/en-GB.json";
import { AcceptanceFingerprint, type FingerprintAcceptance } from "../acceptance-fingerprint";

jest.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) =>
    createTranslator({ locale: "en-GB", messages: enGB, namespace: namespace as never }),
}));

const base: FingerprintAcceptance = {
  acceptedAt: new Date("2026-10-15T00:45:47Z"),
  acceptedByEmail: "bruno@example.com",
  verifiedEmail: true,
  ipAddress: "2406:5a00::1",
  userAgent: "Mozilla/5.0 (Windows NT 10.0)",
  signatureDigest: "a".repeat(64),
  signatureDevice: "TOUCH_DEVICE",
  signatureDeviceUserAgent: "Mozilla/5.0 (iPhone)",
  signatureDeviceIp: "203.0.113.9",
  recordDigest: "b".repeat(64),
};

async function renderFingerprint(acceptance: FingerprintAcceptance) {
  render(
    await AcceptanceFingerprint({
      acceptance,
      locale: "en-GB",
      formatLocale: "en-NZ",
      timezone: "Pacific/Auckland",
    }),
  );
}

describe("AcceptanceFingerprint", () => {
  it("lays out what backs the acceptance, the phone included", async () => {
    await renderFingerprint(base);
    expect(screen.getByText("Verified by email")).toBeInTheDocument();
    expect(screen.getByText("A touch device")).toBeInTheDocument();
    expect(screen.getByText("Mozilla/5.0 (iPhone)")).toBeInTheDocument();
    expect(screen.getByText("a".repeat(64))).toBeInTheDocument();
    expect(screen.getByText("b".repeat(64))).toBeInTheDocument();
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });

  it("doesn't call an address verified when the link wasn't one sent to it", async () => {
    await renderFingerprint({ ...base, verifiedEmail: false });
    expect(screen.queryByText("Verified by email")).not.toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("shows an acceptance from before the fingerprint with only what it has", async () => {
    await renderFingerprint({
      ...base,
      verifiedEmail: null,
      signatureDigest: null,
      signatureDevice: null,
      signatureDeviceUserAgent: null,
      signatureDeviceIp: null,
      recordDigest: null,
    });
    expect(screen.queryByText(/SHA-256/)).not.toBeInTheDocument();
    expect(screen.queryByText("Signed on")).not.toBeInTheDocument();
    expect(screen.getByText("2406:5a00::1")).toBeInTheDocument();
  });
});
