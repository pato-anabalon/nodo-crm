import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev server blocks cross-origin requests to its own assets by
  // default. Needed for the lvh.me trick (see .env.example) that lets
  // cross-subdomain auth — and so `/admin` — be exercised locally over plain
  // HTTP; every company subdomain needs the wildcard, not just one.
  allowedDevOrigins: [
    "lvh.me",
    "**.lvh.me",
    "192.168.1.33",
    "*.192.168.1.33.nip.io",
  ],
  experimental: {
    serverActions: {
      // Every attachment upload (quote-level and per-section) goes through a
      // Server Action, which Next otherwise caps at 1 MB regardless of what
      // the app's own checks allow — `MAX_ATTACHMENT_BYTES` in
      // `modules/quotes/attachments.ts` is the real limit (20 MB, a scanned
      // drawing weighs more than that), so this just stops Next's own default
      // from rejecting a file before that check ever runs. Comfortably above
      // 20 MB for the multipart overhead around the file itself.
      bodySizeLimit: "25mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
