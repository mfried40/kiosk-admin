/**
 * Custom Next.js server with embedded MQTT WebSocket support.
 *
 * Listens on a single port (default 3000) and routes:
 *   - GET /mqtt  (Upgrade: websocket)  → Aedes embedded broker
 *   - Everything else                  → Next.js
 *
 * Usage:
 *   Development:  npx tsx server.ts
 *   Production:   node server.js   (after: npx tsc --project tsconfig.server.json)
 *
 * Devices connect to:  ws://{server-ip}:3000/mqtt
 * Behind TLS proxy:    wss://{domain}/mqtt
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url!, true);
  void handle(req, res, parsedUrl);
});

// WebSocket server (no-server mode — we handle upgrades manually)
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  const url = req.url ?? "";

  if (url === "/mqtt" || url.startsWith("/mqtt?")) {
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      // Lazy-import broker to avoid loading it before Next.js is ready
      void import("./lib/mqtt/broker").then(({ getEmbeddedBroker }) => {
        const broker = getEmbeddedBroker();
        if (broker) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          broker.handle(ws as any);
        } else {
          socket.destroy();
        }
      });
    });
  } else {
    // Let Next.js handle other upgrade events (HMR, etc.)
    socket.destroy();
  }
});

server.listen(port, () => {
  console.log(`> Ready on http://localhost:${port}`);
  console.log(`> MQTT WebSocket available at ws://localhost:${port}/mqtt`);
});
