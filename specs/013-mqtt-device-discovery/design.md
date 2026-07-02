# 013 — MQTT Device Discovery: Design

## Server-side modules

### `lib/mqtt/discovery.ts` (new)
In-memory store for unknown devices and the dismissed set.

```ts
export interface UnknownDevice {
  mqttDeviceId: string;   // from topic
  deviceId: string;       // from payload (same value, Fully Kiosk puts it in payload too)
  deviceName?: string;
  ipAddress?: string;
  model?: string;
  seenAt: Date;
}

// Active unknown devices keyed by mqttDeviceId
const store = new Map<string, UnknownDevice>();

// Dismissed for the lifetime of this server process
const dismissed = new Set<string>();

export function isDismissed(mqttDeviceId: string): boolean
export function recordUnknown(entry: Omit<UnknownDevice, 'seenAt'>): void
export function dismiss(mqttDeviceId: string): void
export function listUnknown(): UnknownDevice[]
```

**`recordUnknown`** logic:
1. If `mqttDeviceId` is in `dismissed` → return immediately.
2. Upsert into `store` (update `seenAt` and any changed fields if already present).
3. Broadcast SSE event `unknown-device` with the entry.

**`dismiss`** logic:
1. Remove from `store`.
2. Add to `dismissed`.
3. Broadcast SSE event `unknown-device-dismissed` with `{ mqttDeviceId }`.

---

### `lib/mqtt/handlers.ts` (update)
In `updateDeviceStatus`, when all three lookup strategies fail (no device found), call `recordUnknown` with the available payload fields:

```ts
if (!device) {
  recordUnknown({
    mqttDeviceId,
    deviceId: payloadDeviceId ?? mqttDeviceId,
    deviceName: payloadDeviceName,   // extract from payload
    ipAddress: payloadIp,
    model: payloadModel,             // extract from payload
  });
  return;
}
```

Extract additional fields from `handleDeviceInfo` payload:
- `deviceName` from `data.deviceName`
- `model` from `data.model`

Pass these through to `updateDeviceStatus` as extra optional parameters.

---

## API Routes

### `GET /api/devices/unknown`
Returns the current list of unknown devices. ADMIN only.

```ts
Response: UnknownDevice[]
```

### `DELETE /api/devices/unknown/[mqttDeviceId]`
Dismisses an unknown device by adding it to the dismissed set. ADMIN only.

```ts
Response: { ok: true }
```

---

## SSE events (additions to `lib/mqtt/sse.ts`)
Two new event types broadcast to all connected clients:

| Event type | Payload | Trigger |
|---|---|---|
| `unknown-device` | `UnknownDevice` | New or updated unknown device seen |
| `unknown-device-dismissed` | `{ mqttDeviceId: string }` | Device dismissed |

---

## Browser: Dashboard page (`app/(app)/page.tsx`)

### Initial load
On mount, fetch `GET /api/devices/unknown` alongside the existing `GET /api/groups` and `GET /api/tags` calls. Store results in `unknownDevices` state.

### SSE handling (additions)
```ts
eventSource.addEventListener('unknown-device', (e) => {
  const entry = JSON.parse(e.data) as UnknownDevice;
  setUnknownDevices(prev => [
    ...prev.filter(d => d.mqttDeviceId !== entry.mqttDeviceId),
    entry,
  ]);
});

eventSource.addEventListener('unknown-device-dismissed', (e) => {
  const { mqttDeviceId } = JSON.parse(e.data);
  setUnknownDevices(prev => prev.filter(d => d.mqttDeviceId !== mqttDeviceId));
});
```

### Discovery banner component (`components/DiscoveredDevicesBanner.tsx`)
Rendered above the device grid when `unknownDevices.length > 0` AND user role is `ADMIN`.

```
┌─────────────────────────────────────────────────────────┐
│ ⚡ Discovered via MQTT — not yet added          [hide ▲] │
├──────────────────────┬──────────────────────────────────┤
│ rk3588               │ 192.168.20.214 · GL-TVQD101       │
│ Seen just now        │               [Dismiss] [Add →]   │
└──────────────────────┴──────────────────────────────────┘
```

Props:
```ts
interface DiscoveredDevicesBannerProps {
  devices: UnknownDevice[];
  groups: Group[];
  tags: Tag[];
  onDismiss: (mqttDeviceId: string) => void;
  onAdded: (mqttDeviceId: string) => void;
}
```

**"Add →"** button opens the existing `DeviceForm` (in a Sheet/Dialog) with initial values:
```ts
{
  name: entry.deviceName ?? '',
  ipAddress: entry.ipAddress ?? '',
  port: 2323,
  provider: 'FULLY_KIOSK',
  mqttDeviceId: entry.deviceId,
}
```

On successful save, calls `onAdded(mqttDeviceId)` which calls `DELETE /api/devices/unknown/[id]` and removes the entry from state.

**"Dismiss"** button calls `DELETE /api/devices/unknown/[id]` directly.

---

## Data flow

```
Fully Kiosk device
  │  MQTT deviceinfo message
  ▼
lib/mqtt/handlers.ts
  │  no DB match found
  ▼
lib/mqtt/discovery.ts recordUnknown()
  │  broadcast SSE unknown-device
  ▼
lib/mqtt/sse.ts broadcast()
  │
  ▼
Browser dashboard (SSE)
  │  unknown-device event
  ▼
DiscoveredDevicesBanner renders
  │  user clicks Add →
  ▼
DeviceForm (pre-filled)
  │  user saves
  ▼
DELETE /api/devices/unknown/[id]  →  dismissed from banner
```
