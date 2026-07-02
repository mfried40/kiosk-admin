# 014 — Fully Cloud Provider: Tasks

### Schema & provider registration
- [x] Add `FULLY_CLOUD` to `enum Provider` in `prisma/schema.prisma`
- [x] Run `npx prisma generate` (SQLite enum — no migration needed)
- [x] Add `FULLY_CLOUD` to `Provider` const in `lib/provider.types.ts`

### Rate limiter
- [x] Create `lib/providers/cloud-rate-limiter.ts` — token-bucket limiter (8 req/sec), `withRateLimit()` helper

### Provider implementation
- [x] Create `lib/providers/fully-cloud.ts` — `FullyCloudProvider` extending `BaseKioskProvider`
  - [x] `static readonly capabilities` (FULLY_KIOSK caps minus screenshot and camshot)
  - [x] `getDeviceInfo()` — `GET /cloud/devices`, map heartbeatInfo fields, mark offline if empty
  - [x] `sendCommand()` — `GET /remote/` with `persistent=1`, handle `status: "Error"` response
  - [x] `flushQueue()` — `GET /cloud/removeDeviceActions`
  - [x] `getScreenshot()` / `getCamshot()` — throw `ProviderCapabilityError`
  - [x] Wrap all HTTP calls in `withRateLimit()`; retry on 429 up to 3×
- [x] Register `FullyCloudProvider` in `lib/providers/index.ts`
- [x] Add `FULLY_CLOUD_CAPS` to `lib/capabilities.ts`

### Probe endpoint
- [x] Extend `POST /api/devices/probe` to handle `FULLY_CLOUD`: call `/cloud/devices` without `devid`, return array of `{ devid, deviceName, online }`

### UI — DeviceForm
- [x] Relabel fields for `FULLY_CLOUD`: "IP Address" → "Account Email", hide Port, "Password" → "API Key", "MQTT Device ID" → "Cloud Device ID"
- [x] Change Fetch behaviour for `FULLY_CLOUD`: show a device picker list populated from the probe result

### UI — Device detail
- [ ] Add **Flush Queue** button on device detail page (visible only for `FULLY_CLOUD` devices)

### Tests
- [ ] Unit tests for `FullyCloudProvider` — `getDeviceInfo`, `sendCommand` (success, error, 429 retry), `flushQueue`
- [ ] Unit tests for `cloud-rate-limiter.ts`

**References:** US-014-1, US-014-2, US-014-3, US-014-4, US-014-5, US-014-6
