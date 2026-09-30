import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev server blocks cross-origin requests to its own assets by
  // default. Needed for the lvh.me trick (see .env.example) that lets
  // cross-subdomain auth — and so `/admin` — be exercised locally over plain
  // HTTP; every company subdomain needs the wildcard, not just one.
  allowedDevOrigins: ["lvh.me", "**.lvh.me"],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
