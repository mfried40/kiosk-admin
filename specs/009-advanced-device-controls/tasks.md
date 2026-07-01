# 009 — Advanced Device Controls: Tasks

## API (already implemented ✅)
- [x] Add `hasMediaPlayer`, `hasMaintenance`, `hasTabManagement`, `hasAppLauncher`, `hasInjectJS`, `hasFileTransfer`, `hasApkManagement` to `ProviderCapabilities`
- [x] Implement `getCamshot()`, `getLogcat()`, `setBooleanSetting()` in `FullyKioskProvider`
- [x] Stub new methods in `FreeKioskProvider`
- [x] Update `lib/capabilities.ts` with all new capability flags
- [x] Expand `CAPABILITY_MAP` in `/api/devices/[id]/command` with ~35 new commands
- [x] Add `GET /api/devices/[id]/camshot`
- [x] Add `GET /api/devices/[id]/logcat`
- [x] Add `GET /api/devices/[id]/device-settings` + `PUT /api/devices/[id]/device-settings`
- [x] Add `POST /api/devices/[id]/inject-js`
- [x] Add `POST /api/devices/[id]/overlay`
- [x] Add `POST /api/devices/[id]/loadzip`
- [x] Add `POST /api/devices/[id]/media`
- [x] Add `GET/POST/DELETE /api/devices/[id]/apk`
- [x] Add `POST /api/devices/[id]/maintenance`
- [x] Add `POST /api/devices/[id]/tabs`

## UI — DeviceControls extensions

### Power section
- [x] Add "Force Sleep" button (`cmd: forceSleep`) with `ConfirmDialog` — refs US-009-14

### Screensaver section
- [x] Add "Start Daydream" and "Stop Daydream" buttons — refs US-009-13

### Browser section (new)
- [x] Build `BrowserControls.tsx` — Clear Cache / Cookies / Web Storage / Webview buttons
- [x] Add tab management sub-section: tab index input, Focus / Close / Refresh buttons
- [x] Wire to `/api/devices/[id]/command` (clear cmds) and `/api/devices/[id]/tabs` — refs US-009-3, US-009-4

### App Launcher section (new)
- [x] Build `AppLauncherControls.tsx` — package input + Launch, intent input + Start Intent, Foreground/Background, Exit App with confirm — refs US-009-8

### Media section (new)
- [x] Build `MediaControls.tsx` — audio (URL, loop, stream selector) + video (URL, 4 toggles)
- [x] Wire audio controls to `POST /api/devices/[id]/media` with `action: playSound/stopSound`
- [x] Wire video controls to `POST /api/devices/[id]/media` with `action: playVideo/stopVideo` — refs US-009-9

### APK Manager section (new)
- [x] Build `ApkManager.tsx` — install (URL + force toggle), uninstall (package + confirm), status display
- [x] Wire install to `POST /api/devices/[id]/apk`
- [x] Wire uninstall to `DELETE /api/devices/[id]/apk`
- [x] Wire status to `GET /api/devices/[id]/apk` — refs US-009-10

### Maintenance section (new)
- [x] Build `MaintenanceControls.tsx` — enable/disable locked mode with confirm, overlay text input + show/clear
- [x] Wire locked mode to `POST /api/devices/[id]/maintenance`
- [x] Wire overlay to `POST /api/devices/[id]/overlay` — refs US-009-6, US-009-7

### JS Injection section (new)
- [x] Build `JsInjector.tsx` — monospace textarea, Run button (disabled when empty)
- [x] Wire to `POST /api/devices/[id]/inject-js` — refs US-009-5

### File Transfer section (new)
- [x] Build `FileTransferControls.tsx` — ZIP URL input, optional dir input, Deploy button
- [x] Wire to `POST /api/devices/[id]/loadzip` — refs US-009-11

### Integrate new sections into device detail page
- [x] Add `CollapsibleSection.tsx` reusable wrapper
- [x] Render new sections in an "Advanced Controls" card (capability-gated)

## UI — New Tabs on Device Detail Page

### Camera tab (new)
- [x] Build `CamshotPanel.tsx` — Capture button, `<img>` display, timestamp, 422-specific inline error
- [x] Add "Camera Snapshot" card to device detail page (conditional on `hasCamshot`) — refs US-009-1

### Logcat sub-tab (extend Logs tab)
- [x] Build `LogsPanel.tsx` — two sub-tabs: "Fully Log" and "Logcat", each with Copy button and auto-scroll
- [x] Wire "Logcat" tab to `GET /api/devices/[id]/logcat`
- [x] Replace `LogPanel` with `LogsPanel` on device detail page — refs US-009-2

### Device Settings panel (new)
- [x] Build `DeviceSettingsPanel.tsx` — Load Settings button, searchable table, inline Edit form
- [x] Wire load to `GET /api/devices/[id]/device-settings`
- [x] Wire save to `PUT /api/devices/[id]/device-settings` with type (string/boolean) + key + value
- [x] Add "Device Settings" collapsible panel to device detail page (conditional on `hasAppManagement`) — refs US-009-12

## Testing
- [ ] Write Vitest tests for `GET /api/devices/[id]/camshot` (success PNG, 422 on disabled, 503 offline)
- [ ] Write Vitest tests for `GET /api/devices/[id]/logcat` (success, 501 unsupported, 503)
- [ ] Write Vitest tests for `GET/PUT /api/devices/[id]/device-settings` (success, type validation, auth)
- [ ] Write Vitest tests for `POST /api/devices/[id]/inject-js` (success, empty code → 400, 501, 503)
- [ ] Write Vitest tests for `POST /api/devices/[id]/overlay` (success, too long → 400, 501)
- [ ] Write Vitest tests for `POST /api/devices/[id]/loadzip` (success, invalid URL → 400, 501)
- [ ] Write Vitest tests for `POST /api/devices/[id]/media` (each action variant, 400 invalid URL, 501)
- [ ] Write Vitest tests for `GET/POST/DELETE /api/devices/[id]/apk` (success paths, 400 bad pkg, 501)
- [ ] Write Vitest tests for `POST /api/devices/[id]/maintenance` (enable, disable, invalid action → 400, 501)
- [ ] Write Vitest tests for `POST /api/devices/[id]/tabs` (focus, close, refresh, negative index → 400, 501)

**References:** US-009-1 through US-009-14
