# 005 — Real-time & MQTT: Design

## Server-side modules

### `lib/mqtt/client.ts`
- Singleton `MqttClient | null`.
- `connect(config: MqttConfig): Promise<void>` — creates `mqtt.connect(...)`, stores in module-level var.
- `disconnect(): void` — calls `.end()`, nullifies var.
- `isConnected(): boolean`.
- `publish(topic: string, payload: string): boolean` — publishes QoS 0 to the active client; returns `false` if not connected.
- `publishCommand(mqttDeviceId: string, prefix: string, cmd: string, params?: Record<string, string>): boolean` — convenience wrapper: builds topic `{prefix}/cmd/{mqttDeviceId}`, serialises payload as JSON `{ cmd, ...params }`, calls `publish()`.
- Called from the MQTT config API route on save/clear.
- On server cold-start: check DB for `MqttConfig` row; if present, auto-connect.

### `lib/mqtt/handlers.ts`
- `handleDeviceInfo(mqttDeviceId, payload)` — parse JSON, find `Device` by `mqttDeviceId`, update `DeviceStatusHistory` (insert + prune), broadcast via SSE.
- `handleEvent(event, mqttDeviceId, payload)` — map event name to status fields, same update+broadcast path.
- Topic subscription registered once after client connects:
  ```
  {prefix}/deviceinfo/+
  {prefix}/event/+/+
  ```
  Handler parses device ID from topic segments.

### `lib/mqtt/sse.ts`
- Registry: `Map<string, ReadableStreamDefaultController>` keyed by connection ID.
- `addClient(id, controller)` — adds to map.
- `removeClient(id)` — removes from map.
- `broadcast(event: string, data: object)` — iterates all controllers, writes SSE frame.
- Keep-alive: a `setInterval` every 25 s writes `: keep-alive\n\n` to all active controllers.

## API Routes

### `GET /api/events` (SSE)
```ts
return new Response(
  new ReadableStream({
    start(controller) {
      const id = crypto.randomUUID()
      addClient(id, controller)
      // cleanup on client disconnect
      req.signal.addEventListener('abort', () => removeClient(id))
    }
  }),
  {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  }
)
```

### `GET /api/config` + `PUT /api/config`
- GET: return `MqttConfig` (password redacted) + SMTP config + retention setting.
- PUT: validate with Zod, encrypt MQTT password if changed, upsert `MqttConfig`, call `connect()` or `disconnect()`.

## Browser client strategy
```ts
// Dashboard: try SSE first, fall back to polling
const eventSource = new EventSource('/api/events')
eventSource.addEventListener('device-update', (e) => {
  const { deviceId, ...fields } = JSON.parse(e.data)
  updateDeviceCard(deviceId, fields)
})
eventSource.onerror = () => {
  eventSource.close()
  startPolling(30_000)  // fall back to HTTP polling
}
```

## Command routing in `POST /api/devices/[id]/command`

After capability validation, the route chooses a transport:

```
if (device.mqttDeviceId && isConnected()) {
  const ok = publishCommand(device.mqttDeviceId, prefix, cmd, params)
  if (!ok) return 502 "MQTT publish failed"
  audit log
  return { ok: true, transport: "mqtt" }
} else {
  // existing path: provider.sendCommand(device, cmd, params)
  audit log
  return { ok: true, result, transport: "http" }
}
```

`prefix` is read from `activeConfig.topicPrefix` (falls back to `"fully"`).

The route does **not** need to know the device provider — MQTT command payloads use the Fully Kiosk REST parameter naming convention that all Kiosk apps supporting MQTT share.

## MqttConfig data model
```prisma
model MqttConfig {
  id          String  @id @default(uuid())
  brokerUrl   String
  username    String?
  passwordEnc String?   // AES-256-GCM encrypted
  topicPrefix String  @default("fully")
}
```
