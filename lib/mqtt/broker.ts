/**
 * Embedded MQTT broker singleton.
 * Exposes two ports: TCP (MQTT) and WebSocket (WS/WSS via a reverse proxy).
 * Uses globalThis to survive Turbopack hot reloads (same pattern as lib/db.ts).
 *
 * refs specs/015-embedded-mqtt-broker
 */

import { createServer, type Server } from "net";
import { WebSocketServer, type WebSocket } from "ws";
import websocketStream from "websocket-stream";
import { Aedes, type AedesOptions, type AuthErrorCode } from "aedes";
import type { Client } from "aedes";

// Persist across Turbopack hot reloads — module re-evaluation resets locals
// while OS ports stay bound → EADDRINUSE.
const g = globalThis as unknown as {
  _aedesBroker?: Aedes | null;
  _aedesTcpServer?: Server | null;
  _aedesPort?: number | null;
  _aedesWsServer?: WebSocketServer | null;
  _aedesWsPort?: number | null;
};
if (g._aedesBroker    === undefined) g._aedesBroker    = null;
if (g._aedesTcpServer === undefined) g._aedesTcpServer = null;
if (g._aedesPort      === undefined) g._aedesPort      = null;
if (g._aedesWsServer  === undefined) g._aedesWsServer  = null;
if (g._aedesWsPort    === undefined) g._aedesWsPort    = null;

export function isEmbeddedRunning(): boolean {
  return g._aedesTcpServer?.listening ?? false;
}

export function getEmbeddedBroker(): Aedes | null {
  return g._aedesBroker ?? null;
}

export function embeddedClientCount(): number {
  return g._aedesBroker?.connectedClients ?? 0;
}

export function getEmbeddedPort(): number | null {
  return isEmbeddedRunning() ? g._aedesPort ?? null : null;
}

export function getEmbeddedWsPort(): number | null {
  return g._aedesWsServer ? g._aedesWsPort ?? null : null;
}

export interface EmbeddedBrokerAuth {
  username: string;
  password: string;
}

export interface EmbeddedBrokerOptions {
  tcpPort: number;
  wsPort?: number;  // optional WebSocket port (e.g. 9883)
  auth?: EmbeddedBrokerAuth;
}

export async function startEmbedded(
  port: number,
  auth?: EmbeddedBrokerAuth,
  wsPort?: number,
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

  // TCP server
  const tcpServer = createServer(broker.handle.bind(broker));
  await new Promise<void>((resolve, reject) => {
    tcpServer.once("error", (err) => {
      console.error("[MQTT Broker] TCP failed to start:", (err as NodeJS.ErrnoException).message);
      reject(err);
    });
    tcpServer.listen(port, () => {
      console.log(`[MQTT Broker] TCP listening on port ${port}`);
      resolve();
    });
  });

  // WebSocket server (optional)
  let wsServer: WebSocketServer | null = null;
  if (wsPort) {
    wsServer = new WebSocketServer({ port: wsPort });
    wsServer.on("connection", (ws: WebSocket, req) => {
      // Wrap the WebSocket in a Duplex stream — Aedes requires a stream, not a raw WS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = websocketStream(ws as any);
      broker.handle(stream, req);
    });
    await new Promise<void>((resolve, reject) => {
      wsServer!.once("error", (err) => {
        console.error("[MQTT Broker] WS failed to start:", (err as NodeJS.ErrnoException).message);
        reject(err);
      });
      wsServer!.once("listening", () => {
        console.log(`[MQTT Broker] WebSocket listening on port ${wsPort}`);
        resolve();
      });
    });
  }

  g._aedesBroker    = broker;
  g._aedesTcpServer = tcpServer;
  g._aedesPort      = port;
  g._aedesWsServer  = wsServer;
  g._aedesWsPort    = wsPort ?? null;
}

export async function stopEmbedded(): Promise<void> {
  const broker   = g._aedesBroker;
  const tcpServer = g._aedesTcpServer;
  const wsServer  = g._aedesWsServer;
  if (!tcpServer) return;

  await new Promise<void>((resolve) => {
    let pending = 1 + (wsServer ? 1 : 0);
    const done = () => { if (--pending === 0) resolve(); };

    broker?.close(() => {
      tcpServer.close(() => {
        g._aedesBroker    = null;
        g._aedesTcpServer = null;
        g._aedesPort      = null;
        console.log("[MQTT Broker] Embedded broker stopped");
        done();
      });
    });

    if (wsServer) {
      wsServer.close(() => {
        g._aedesWsServer = null;
        g._aedesWsPort   = null;
        done();
      });
    }
  });
}
