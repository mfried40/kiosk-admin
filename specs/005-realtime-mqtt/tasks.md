# 005 — Real-time & MQTT: Tasks

- [x] Add `MqttConfig` model to both Prisma schemas; run migrate / db push
- [x] Implement `lib/mqtt/client.ts` — singleton connect/disconnect, auto-connect on cold start
- [x] Implement `lib/mqtt/sse.ts` — client registry, broadcast, 25 s keep-alive
- [x] Implement `lib/mqtt/handlers.ts` — `handleDeviceInfo`, `handleEvent`, topic subscription wiring
- [x] Implement `GET /api/events` — SSE stream, cleanup on abort
- [x] Implement `GET /api/config` — return MQTT + SMTP config (password redacted)
- [x] Implement `PUT /api/config` — validate, encrypt MQTT password, upsert, connect/disconnect client
- [x] Build `app/settings/page.tsx` — MQTT form, SMTP form, retention setting, connection status indicator
- [x] Update dashboard to open EventSource + fall back to 30 s polling on error
- [x] Write Vitest tests for `lib/mqtt/handlers.ts` (mock MQTT message → DB update + broadcast)
- [x] Write Vitest tests for `lib/mqtt/sse.ts` (addClient, removeClient, broadcast, keep-alive)
- [ ] Write Vitest tests for `PUT /api/config` (happy path, invalid broker URL, encrypt password)

### Command routing (US-005-5, US-005-6)
- [ ] Add `publish(topic, payload)` to `lib/mqtt/client.ts`
- [ ] Add `publishCommand(mqttDeviceId, prefix, cmd, params?)` helper to `lib/mqtt/client.ts`
- [ ] Update `POST /api/devices/[id]/command` to route through MQTT when `device.mqttDeviceId` is set and broker is connected, with HTTP fallback
- [ ] Add `transport: "mqtt" | "http"` field to command response
- [ ] Write Vitest tests for MQTT command routing (publish called, fallback to HTTP, 502 on publish failure)

**References:** US-005-1, US-005-2, US-005-3, US-005-4, US-005-5, US-005-6
