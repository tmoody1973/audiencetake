import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
