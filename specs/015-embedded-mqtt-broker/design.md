# 015 — Embedded MQTT Broker: Design

## Architecture

```
Settings page toggle (Embedded / External)
         |
  PUT /api/config  { mqttMode: "embedded", embeddedPort: 1883, ... }
         |
  lib/mqtt/broker.ts  ← singleton
    startEmbedded(port, auth?) → net.Server + Aedes
    stopEmbedded()
    embeddedClientCount()
         |
  lib/mqtt/client.ts  (unchanged)
    connect({ brokerUrl: "mqtt://localhost:1883", ... })
         |
  Devices connect to server-ip:1883 (TCP MQTT)
```

## Schema changes

Add two fields to `MqttConfig`:

```prisma
model MqttConfig {
  id            String  @id @default(uuid())
  brokerUrl     String
  username      String?
  passwordEnc   String?
  topicPrefix   String  @default("fully")
  // Embedded broker fields
  mode          String  @default("external")  // "embedded" | "external"
  embeddedPort  Int     @default(1883)
}
```

Requires `prisma migrate dev --name mqtt_embedded_mode`.

## `lib/mqtt/broker.ts` (new)

Singleton module that manages the Aedes TCP server:

```ts
import { createServer } from "net";
import aedes, { type Aedes } from "aedes";

let broker: Aedes | null = null;
let server: ReturnType<typeof createServer> | null = null;

export function isEmbeddedRunning(): boolean { ... }
export function embeddedClientCount(): number { ... }
export function embeddedPort(): number | null { ... }

export async function startEmbedded(
  port: number,
  auth?: { username: string; password: string },
): Promise<void> { ... }

export async function stopEmbedded(): Promise<void> { ... }
```

`startEmbedded` creates an Aedes instance with optional `authenticate` callback,
wraps it in a `net.createServer`, and listens on the given port.

## `lib/mqtt/client.ts` changes

`autoConnect()` is extended to handle embedded mode:

```ts
export async function autoConnect(): Promise<void> {
  const { db } = await import("../db");
  const config = await db.mqttConfig.findFirst();
  if (!config) return;

  if (config.mode === "embedded") {
    const { startEmbedded } = await import("./broker");
    await startEmbedded(config.embeddedPort, /* auth from config */);
    await connect({
      ...config,
      brokerUrl: `mqtt://localhost:${config.embeddedPort}`,
    });
  } else {
    await connect(config);
  }
}
```

## `PUT /api/config` changes

When `mqttMode === "embedded"`:
1. Stop any existing embedded broker
2. Start new embedded broker on `embeddedPort`
3. Upsert `MqttConfig` with `mode = "embedded"`, `brokerUrl = "mqtt://localhost:{port}"`
4. Connect MQTT client to the embedded broker

When `mqttMode === "external"`:
1. Stop embedded broker (if running)
2. Upsert `MqttConfig` with `mode = "external"` and the provided `brokerUrl`
3. Connect MQTT client to the external broker

## `GET /api/config/broker-status` (new)

Returns the current embedded broker state (polled by Settings UI every 5 s):

```ts
Response: {
  mode: "embedded" | "external";
  running: boolean;
  port: number | null;
  clientCount: number;
}
```

## Settings UI changes

The MQTT section gains a **Mode** radio/toggle:

```
Mode:  ○ External  ● Embedded
                    └── Port: [1883]
                    └── Require credentials: [ ] Username  [ ] Password

Status: ● Running on port 1883 — 2 clients connected
```

When **External** is selected, the existing Broker URL / Username / Password fields show as before.

When **Embedded** is selected:
- Broker URL field is hidden (auto-set to `mqtt://localhost:{port}`)
- Port field appears
- Optional credentials fields appear
- Status badge shows running state + client count (polled every 5 s)
