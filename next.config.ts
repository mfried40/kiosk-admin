import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["local-dev-2.scorespaces.com"],
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    // Proxy /mqtt → the env-configured WS port (always started by the embedded broker)
    const wsPort = process.env.MQTT_WS_PORT ?? "19883";
    return [
      {
        source: "/mqtt",
        destination: `http://localhost:${wsPort}/`,
      },
    ];
  },
};

export default nextConfig;
