# 015 — Embedded MQTT Broker: Tasks

### Dependencies
- [ ] `npm install aedes`
- [ ] `npm install --save-dev @types/aedes`

### Schema
- [ ] Add `mode String @default("external")` and `embeddedPort Int @default(1883)` to `MqttConfig` in `prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name mqtt_embedded_mode`
- [ ] Run `npx prisma generate`

### Broker singleton
- [ ] Create `lib/mqtt/broker.ts` — Aedes + net.Server singleton; exports `startEmbedded(port, auth?)`, `stopEmbedded()`, `isEmbeddedRunning()`, `embeddedClientCount()`, `embeddedPort()`

### Client / auto-connect
- [ ] Extend `autoConnect()` in `lib/mqtt/client.ts` to check `config.mode === "embedded"`, call `startEmbedded()` then `connect()` with `mqtt://localhost:{port}`

### API
- [ ] Update `PUT /api/config` to handle `mqttMode: "embedded" | "external"`, manage broker lifecycle (start/stop), and set `brokerUrl` automatically for embedded mode
- [ ] Add `GET /api/config/broker-status` returning `{ mode, running, port, clientCount }`

### Settings UI
- [ ] Add **Mode** toggle (Embedded / External) to the MQTT settings form
- [ ] Show Port + optional credentials fields when Embedded is selected; hide Broker URL
- [ ] Add status badge polling `GET /api/config/broker-status` every 5 seconds when embedded is active

**References:** US-015-1, US-015-2, US-015-3, US-015-4, US-015-5, US-015-6
