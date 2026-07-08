import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["local-dev-2.scorespaces.com"],
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    // Read the WS port from the database so it matches whatever the embedded
    // broker is actually configured to use. Falls back to MQTT_WS_PORT env var.
    let wsPort = parseInt(process.env.MQTT_WS_PORT ?? "19883", 10);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require("better-sqlite3") as (path: string) => { prepare: (sql: string) => { get: () => Record<string, unknown> | undefined }; close: () => void };
      const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
      const db = Database(dbPath);
      const row = db.prepare("SELECT embeddedWsPort FROM MqttConfig WHERE mode = 'embedded' LIMIT 1").get();
      if (row?.embeddedWsPort) wsPort = Number(row.embeddedWsPort);
      db.close();
    } catch {
      // DB not ready yet (first run before migrate) — use env var default
    }
    return [
      {
        source: "/mqtt",
        destination: `http://localhost:${wsPort}/`,
      },
    ];
  },
};

export default nextConfig;
