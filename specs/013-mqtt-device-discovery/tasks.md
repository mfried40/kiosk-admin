# 013 — MQTT Device Discovery: Tasks

### Server
- [x] Create `lib/mqtt/discovery.ts` — in-memory `store` Map, `dismissed` Set; implement `recordUnknown`, `dismiss`, `isDismissed`, `listUnknown`
- [x] Update `lib/mqtt/handlers.ts` — extract `deviceName` and `model` from `handleDeviceInfo` payload; pass to `updateDeviceStatus`; call `recordUnknown` when all lookup strategies fail
- [x] Add `GET /api/devices/unknown` — return `listUnknown()`, ADMIN only
- [x] Add `DELETE /api/devices/unknown/[mqttDeviceId]` — call `dismiss()`, broadcast SSE `unknown-device-dismissed`, ADMIN only

### Browser
- [x] Create `components/DiscoveredDevicesBanner.tsx` — collapsible banner listing unknown devices; "Add →" opens DeviceForm pre-filled; "Dismiss" calls DELETE endpoint
- [x] Update `DeviceForm` props to accept optional `initialValues` so it can be opened pre-filled from the banner
- [x] Update `app/(app)/page.tsx` — fetch `GET /api/devices/unknown` on mount; handle `unknown-device` and `unknown-device-dismissed` SSE events; render `DiscoveredDevicesBanner` above the device grid (ADMIN role only)

### Tests
- [ ] Unit test `lib/mqtt/discovery.ts` — recordUnknown (upsert, dismissed guard), dismiss (removes + adds to set, broadcasts)
- [ ] Unit test `handlers.ts` — unknown device path calls recordUnknown with correct fields

**References:** US-013-1, US-013-2, US-013-3, US-013-4, US-013-5
