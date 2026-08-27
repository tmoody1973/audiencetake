import type { NextConfig } from "next";

import { resolveOutputFileTracingRoot } from "./lib/build/output-tracing";

const appRoot = process.cwd();

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolveOutputFileTracingRoot(appRoot),
  serverExternalPackages: ["@google-cloud/tasks"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
