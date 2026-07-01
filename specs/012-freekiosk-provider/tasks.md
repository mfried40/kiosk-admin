# 012 — FreeKiosk Provider: Tasks

## Implementation

- [x] Replace stub in `lib/providers/free-kiosk.ts` with full `FreeKioskProvider`
      class — private `request()` helper, `getDeviceInfo()`, `getScreenshot()`,
      `getCamshot()`, `sendCommand()` switch, unsupported method stubs
      — refs US-012-1 through US-012-16

- [x] Update `static readonly capabilities` on `FreeKioskProvider` to match the
      capability table in design.md — refs US-012-18

- [x] Update `FREE_KIOSK` entry in `lib/capabilities.ts` to match the same table
      — refs US-012-18

- [x] Verify `lib/providers/index.ts` resolver already maps `Provider.FREE_KIOSK`
      to `FreeKioskProvider` (it should from spec 003); fix if not

- [x] Run `npx tsc --noEmit` — fix all type errors

## Testing

- [x] Write `lib/providers/__tests__/free-kiosk.test.ts`
  - [x] `getDeviceInfo()` maps `/api/status` response to `DeviceInfo` correctly
  - [x] `getDeviceInfo()` propagates `ProviderError` on non-2xx
  - [x] `getDeviceInfo()` throws `ProviderError(503)` on timeout (AbortController)
  - [x] `getScreenshot()` calls `GET /api/screenshot` and returns Buffer
  - [x] `getCamshot()` appends `camera` and `quality` query params when provided
  - [x] `sendCommand("screenOn")` calls `POST /api/screen/on`
  - [x] `sendCommand("screenOff")` calls `POST /api/screen/off`
  - [x] `sendCommand("loadUrl", { url })` calls `POST /api/url` with correct body
  - [x] `sendCommand("reload")` calls `POST /api/reload`
  - [x] `sendCommand("textToSpeech", { text, language })` includes language in body
  - [x] `sendCommand("textToSpeech", { text })` omits language key from body
  - [x] `sendCommand("setVolume", { level })` sends `{ value: number }` body
  - [x] `sendCommand("startApplication", { package })` calls `POST /api/app/launch`
  - [x] `sendCommand("reboot")` calls `POST /api/reboot`
  - [x] `sendCommand("lock")` calls `POST /api/lock`
  - [x] `sendCommand("injectJS", { code })` calls `POST /api/js`
  - [x] `sendCommand("unknownCmd")` throws `ProviderCapabilityError`
  - [x] `getSettings()` throws `ProviderCapabilityError`
  - [x] `setSetting()` throws `ProviderCapabilityError`
  - [x] `getFiles()` throws `ProviderCapabilityError`
  - [x] `getLogs()` throws `ProviderCapabilityError`
  - [x] API key is sent as `X-Api-Key` header when `device.passwordEnc` is set
  - [x] No `X-Api-Key` header when `device.passwordEnc` is null/undefined

- [x] Run `npm test` — all tests pass (88 total)

## Validation

- [ ] Manually add a FREE_KIOSK device in dev and confirm the Overview tab renders
      (or shows offline gracefully if no device is reachable)
- [ ] Confirm Settings tab is hidden for FREE_KIOSK devices (capability `false`)
- [ ] Confirm APK, File Transfer, and Logs sub-tabs are hidden for FREE_KIOSK devices
- [ ] Update `steering/structure.md` — mark spec 012 complete

**References:** US-012-1 through US-012-18
