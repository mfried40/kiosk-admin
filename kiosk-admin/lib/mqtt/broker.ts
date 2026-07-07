/**
 * Embedded MQTT broker singleton.
 * Wraps Aedes in a Node.js TCP server that can be started/stopped at runtime.
 * Uses globalThis to survive Turbopack hot reloads (same pattern as lib/db.ts).
 *
 * refs specs/015-embedded-mqtt-broker
 */

import { createServer, type Server } from "net";
import { Aedes, type AedesOptions, type AuthErrorCode } from "aedes";
import type { Client } from "aedes";

// Persist across Turbopack hot reloads — without this, module re-evaluation
// resets variables to null while the OS port is still bound → EADDRINUSE.
const g = globalThis as unknown as {
  _aedesBroker?: Aedes | null;
  _aedesTcpServer?: Server | null;
  _aedesPort?: number | null;
};
if (g._aedesBroker === undefined) g._aedesBroker = null;
if (g._aedesTcpServer === undefined) g._aedesTcpServer = null;
if (g._aedesPort === undefined) g._aedesPort = null;

export function isEmbeddedRunning(): boolean {
  return g._aedesTcpServer?.listening ?? false;
}

export function embeddedClientCount(): number {
  return g._aedesBroker?.connectedClients ?? 0;
}

export function getEmbeddedPort(): number | null {
  return isEmbeddedRunning() ? g._aedesPort ?? null : null;
}

export interface EmbeddedBrokerAuth {
  username: string;
  password: string;
}

export async function startEmbedded(
  port: number,
  auth?: EmbeddedBrokerAuth,
): Promise<void> {
  if (isEmbeddedRunning()) {
    await stopEmbedded();
  }

  const options: AedesOptions = {};
  if (auth) {
    options.authenticate = (
      _client: Client,
      username: Readonly<string | undefined>,
      password: Readonly<Buffer | undefined>,
      callback: (err: (Error & { returnCode: AuthErrorCode }) | null, success: boolean | null) => void,
    ) => {
      const valid = username === auth.username && password?.toString() === auth.password;
      callback(null, valid);
    };
  }

  const broker = new Aedes(options);
  // Aedes requires listen() before handle() — sets broker.closed = false
  await broker.listen();

  broker.on("client", (client: Client) => {
    console.log(`[MQTT Broker] Client connected: ${client.id}`);
  });
  broker.on("clientDisconnect", (client: Client) => {
    console.log(`[MQTT Broker] Client disconnected: ${client.id}`);
  });

  const server = createServer(broker.handle.bind(broker));

  await new Promise<void>((resolve, reject) => {
    server.once("error", (err) => {
      console.error("[MQTT Broker] Failed to start:", (err as NodeJS.ErrnoException).message);
      reject(err);
    });
    server.listen(port, () => {
      g._aedesBroker = broker;
      g._aedesTcpServer = server;
      g._aedesPort = port;
      console.log(`[MQTT Broker] Embedded broker listening on port ${port}`);
      resolve();
    });
  });
}

export async function stopEmbedded(): Promise<void> {
  const broker = g._aedesBroker;
  const server = g._aedesTcpServer;
  if (!server) return;
  await new Promise<void>((resolve) => {
    broker?.close(() => {
      server.close(() => {
        g._aedesBroker = null;
        g._aedesTcpServer = null;
        g._aedesPort = null;
        console.log("[MQTT Broker] Embedded broker stopped");
        resolve();
      });
    });
  });
}
