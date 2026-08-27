import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = process.cwd();
const workspaceRoot = resolve(appRoot, "../..");
const tracingRoot = existsSync(resolve(appRoot, "node_modules/next/package.json"))
  ? appRoot
  : workspaceRoot;

const nextConfig: NextConfig = {
  outputFileTracingRoot: tracingRoot,
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
