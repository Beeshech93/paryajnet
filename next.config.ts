import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    // KYC uploads: images are downscaled in the browser, this is a safety cap.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default withNextIntl(nextConfig);
