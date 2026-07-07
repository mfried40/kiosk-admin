import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["local-dev-2.scorespaces.com"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
