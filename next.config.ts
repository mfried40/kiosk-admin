import type { NextConfig } from "next";

// Internal port the embedded MQTT WebSocket broker binds to.
// Next.js proxies ws(s)://{domain}/mqtt → this port so no extra firewall rule is needed.
const MQTT_WS_PORT = process.env.MQTT_WS_PORT ?? "9883";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["local-dev-2.scorespaces.com"],
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/mqtt",
        destination: `http://localhost:${MQTT_WS_PORT}/`,
      },
    ];
  },
};

export default nextConfig;
