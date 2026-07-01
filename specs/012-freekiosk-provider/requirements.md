# 012 — FreeKiosk Provider: Requirements

## Context

FreeKiosk (https://github.com/RushB-fr/freekiosk) is an open-source Android kiosk app
with a REST API that uses JSON over HTTP. Its API shape differs significantly from Fully
Kiosk: it uses REST paths (`POST /api/url`) instead of query-string commands
(`?cmd=loadUrl`), and it uses an `X-Api-Key` header for auth rather than a `password`
query param.

Spec 003 established the `KioskProvider` abstraction and shipped a stub that throws
`ProviderCapabilityError` for every method. This spec replaces that stub with a
fully-functional implementation.

---

## User Stories

### US-012-1: Status polling
As an admin, I want FreeKiosk devices to report live status (battery, screen, URL,
model, storage), so that the Overview tab shows real data.

**Acceptance criteria**
- WHERE the device provider is `FREE_KIOSK`, `getDeviceInfo()` SHALL call
  `GET /api/status` and map the response to `DeviceInfo`.
- The mapping SHALL include: `online`, `batteryLevel`, `screenOn`, `currentUrl`,
  `deviceModel`, `androidVersion`, `appVersion` (from `GET /api/info`),
  `storageTotal`, `storageFree`.
- IF the request times out or returns a non-2xx status, the provider SHALL throw
  `ProviderError` with the HTTP status (or `503` for network failures).

### US-012-2: Screenshot
As an admin, I want to capture a screenshot from a FreeKiosk device, so that I can
visually inspect what is shown on screen.

**Acceptance criteria**
- `getScreenshot()` SHALL call `GET /api/screenshot` and return the raw PNG bytes.
- The capability flag `hasScreenshot` SHALL be `true` for `FREE_KIOSK`.

### US-012-3: Screen control
As an admin, I want to turn the screen on or off on a FreeKiosk device, so that I can
manage power usage remotely.

**Acceptance criteria**
- `sendCommand("screenOn")` SHALL call `POST /api/screen/on`.
- `sendCommand("screenOff")` SHALL call `POST /api/screen/off`.
- The capability flag `hasScreenControl` SHALL be `true`.

### US-012-4: URL navigation
As an admin, I want to navigate a FreeKiosk device to a URL or reload its current page,
so that I can change what content is displayed.

**Acceptance criteria**
- `sendCommand("loadUrl", { url })` SHALL call `POST /api/url` with body `{ "url": "…" }`.
- `sendCommand("reload")` SHALL call `POST /api/reload`.
- The capability flag `hasUrlControl` SHALL be `true`.

### US-012-5: App restart
As an admin, I want to restart the FreeKiosk UI without rebooting the device, so that
I can recover from display glitches remotely.

**Acceptance criteria**
- `sendCommand("restartApp")` SHALL call `POST /api/restart-ui`.
- The capability flag `hasAppRestart` SHALL be `true`.

### US-012-6: Screensaver control
As an admin, I want to enable, disable, and wake the screensaver on FreeKiosk devices,
so that I can manage display timers remotely.

**Acceptance criteria**
- `sendCommand("startScreensaver")` SHALL call `POST /api/screensaver/on`.
- `sendCommand("stopScreensaver")` SHALL call `POST /api/screensaver/off`.
- `sendCommand("wake")` SHALL call `POST /api/wake`.
- The capability flag `hasScreensaver` SHALL be `true`.

### US-012-7: Text-to-speech
As an admin, I want to make a FreeKiosk device speak a message, so that I can send
audible alerts to devices in the field.

**Acceptance criteria**
- `sendCommand("textToSpeech", { text, language? })` SHALL call `POST /api/tts` with
  body `{ "text": "…", "language": "…" }` (omit `language` if not provided).
- The capability flag `hasTTS` SHALL be `true`.

### US-012-8: Volume control
As an admin, I want to set the media volume on a FreeKiosk device.

**Acceptance criteria**
- `sendCommand("setVolume", { level })` SHALL call `POST /api/volume` with body
  `{ "value": <number> }`.
- The capability flag `hasVolume` SHALL be `true`.

### US-012-9: Camera capture
As an admin, I want to capture a photo from the FreeKiosk device camera.

**Acceptance criteria**
- `getCamshot()` (or `sendCommand("camshot", { camera?, quality? })`) SHALL call
  `GET /api/camera/photo` with optional query params `camera` (front|back) and
  `quality` (1-100).
- The capability flag `hasCamshot` SHALL be `true`.

### US-012-10: Audio / media playback
As an admin, I want to play audio from a URL or trigger a beep on a FreeKiosk device.

**Acceptance criteria**
- `sendCommand("playFile", { url, loop?, volume? })` SHALL call `POST /api/audio/play`.
- `sendCommand("stopMedia")` SHALL call `POST /api/audio/stop`.
- `sendCommand("beep")` SHALL call `POST /api/audio/beep`.
- The capability flag `hasMediaPlayer` SHALL be `true`.

### US-012-11: Maintenance (reboot / lock)
As an admin, I want to reboot or lock a FreeKiosk device remotely.

**Acceptance criteria**
- `sendCommand("reboot")` SHALL call `POST /api/reboot`.
- `sendCommand("lock")` SHALL call `POST /api/lock`.
- The capability flag `hasMaintenance` SHALL be `true`.
- The UI SHALL note that `reboot` requires Device Owner mode on the device.

### US-012-12: App launcher
As an admin, I want to launch an installed app on a FreeKiosk device by package name.

**Acceptance criteria**
- `sendCommand("startApplication", { package })` SHALL call `POST /api/app/launch` with
  body `{ "package": "…" }`.
- The capability flag `hasAppLauncher` SHALL be `true`.

### US-012-13: JavaScript injection
As an admin, I want to execute JavaScript in the FreeKiosk WebView.

**Acceptance criteria**
- `sendCommand("injectJS", { code })` SHALL call `POST /api/js` with body
  `{ "code": "…" }`.
- The capability flag `hasInjectJS` SHALL be `true`.

### US-012-14: Brightness control
As an admin, I want to set or automate screen brightness on a FreeKiosk device.

**Acceptance criteria**
- `sendCommand("setBrightness", { value })` SHALL call `POST /api/brightness` with body
  `{ "value": <number> }`.
- `sendCommand("enableAutoBrightness", { min?, max?, offset? })` SHALL call
  `POST /api/autoBrightness/enable`.
- `sendCommand("disableAutoBrightness")` SHALL call `POST /api/autoBrightness/disable`.

### US-012-15: Utility commands
As an admin, I want to send toast notifications, clear the WebView cache, or switch
display mode on FreeKiosk devices.

**Acceptance criteria**
- `sendCommand("toast", { text })` SHALL call `POST /api/toast` with body `{ "text": "…" }`.
- `sendCommand("clearCache")` SHALL call `POST /api/clearCache`.
- `sendCommand("switchMode", { mode, url?, package? })` SHALL call `POST /api/mode`.

### US-012-16: Unsupported capabilities
As a developer, I want the provider to clearly reject unsupported operations so that API
routes return `501` rather than silently failing.

**Acceptance criteria**
- `getSettings()`, `setSetting()`, `getFiles()`, `getLogs()` SHALL throw
  `ProviderCapabilityError("FREE_KIOSK", "<method>")`.
- The capability flags `hasFileManagement`, `hasFileTransfer`, `hasApkManagement`,
  `hasTabManagement`, `hasLogViewer`, `hasAppManagement` SHALL be `false`.

### US-012-17: Authentication
As an admin, I want FreeKiosk devices to authenticate using an API key header, so that
devices with key protection work correctly.

**Acceptance criteria**
- IF the device has a `password` stored, the provider SHALL include it as the
  `X-Api-Key` request header on every call.
- IF the device has no password stored, the header SHALL be omitted.
- The API key SHALL be decrypted at call time using the existing `decrypt()` utility;
  it SHALL never appear in plaintext in the database.

### US-012-18: Capability flag update
As a developer, I want `FREE_KIOSK` in `lib/capabilities.ts` to reflect the real
FreeKiosk capability set, so that the UI hides controls that FreeKiosk does not support.

**Acceptance criteria**
- `FREE_KIOSK` capabilities in `lib/capabilities.ts` SHALL match the table in design.md.

---

## Out of Scope
- FreeKiosk settings API (does not exist; settings are managed via ADB or the app UI).
- APK install/uninstall (not in FreeKiosk REST API).
- Multi-tab management (FreeKiosk is single-WebView).
- GPS location endpoint (informational only; not wired to device detail UI in this spec).
- Remote keyboard / D-pad endpoints (Android TV feature; out of scope for kiosk admin).
- MQTT for FreeKiosk (separate spec if needed).
