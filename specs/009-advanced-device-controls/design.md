# 009 — Advanced Device Controls: Design

## Overview
All API routes are already implemented (see session history). This spec focuses on the UI layer:
new sections/panels added to the device detail page and, where appropriate, standalone tabs.

---

## Page structure — Device Detail (`/devices/[id]`)

```
Device Detail
├── Header (name, status badge, provider badge)
├── Tabs
│   ├── Overview        (existing — DeviceInfo, history chart)
│   ├── Controls        (existing — extended by this spec)
│   ├── Logs            (existing — extended: "Fully Log" + new "Logcat" sub-tab)
│   ├── Files           (existing)
│   ├── Device Settings (NEW — US-009-12)
│   └── Camera          (NEW — US-009-1, only when hasCamshot)
└── [DeviceControls sections — see below]
```

---

## `DeviceControls` section additions

Each section is an `<Accordion>` item (Shadcn `Accordion`) so the page stays scannable.
Sections only render when the corresponding capability flag is `true`.

### Power section (extends spec 004)
Capability: `hasScreenControl`

New button added:
- **Force Sleep** — `cmd: "forceSleep"`, preceded by `ConfirmDialog`

### Screensaver section (extends spec 004)
Capability: `hasScreensaver`

New buttons added:
- **Start Daydream** — `cmd: "startDaydream"`
- **Stop Daydream** — `cmd: "stopDaydream"`

### Browser section (NEW)
Capability: `hasUrlControl` (tab management: `hasTabManagement`)

Controls:
```
[Clear Cache]  [Clear Cookies]  [Clear Web Storage]  [Reset Webview]

── Tab Management (hasTabManagement) ──
Tab index: [____]   [Focus Tab]  [Close Tab]
                    [Refresh Tab]
```

All clear buttons POST to `/api/devices/[id]/command` with respective `cmd`.
Tab controls POST to `/api/devices/[id]/tabs`.

### App Launcher section (NEW)
Capability: `hasAppLauncher`

```
Package: [________________]  [Launch App]
Intent:  [________________]  [Start Intent]
[Bring to Foreground]  [Send to Background]  [Exit App ⚠]
```

Exit App shows `ConfirmDialog` first.
All send POST to `/api/devices/[id]/command`.

### Media section (NEW)
Capability: `hasMediaPlayer`

```
── Audio ──
URL: [_________________________]
Loop: [ ]  Stream: [Music ▾]
[Play Sound]  [Stop Sound]

── Video ──
URL: [_________________________]
[ ] Loop  [ ] Show Controls  [ ] Exit on Touch  [ ] Exit on Completion
[Play Video]  [Stop Video]
```

Audio and video each POST to `/api/devices/[id]/media`.

**Stream selector options** (Android audio stream types):
| Value | Label |
|---|---|
| 0 | Voice Call |
| 1 | System |
| 2 | Ring |
| 3 | Music (default) |
| 4 | Alarm |
| 5 | Notification |

### APK Manager section (NEW)
Capability: `hasApkManagement`

```
── Install ──
URL: [____________________________]  [ ] Force Install
[Install APK]

── Uninstall ──
Package: [_____________________]
[Uninstall App ⚠]

── Status ──
[Check Install Status]
[status JSON rendered inline]
```

Install → POST `/api/devices/[id]/apk`
Uninstall → DELETE `/api/devices/[id]/apk`
Status → GET `/api/devices/[id]/apk`

### Maintenance section (NEW)
Capability: `hasMaintenance`

```
── Locked Mode ──
[Enable Maintenance Mode ⚠]  [Disable Maintenance Mode ⚠]

── Overlay Message ──
[_________________________________] (max 500 chars)
[Show Overlay]  [Clear Overlay]
```

Locked mode buttons → POST `/api/devices/[id]/maintenance`
Overlay buttons → POST `/api/devices/[id]/overlay`

### JS Injection section (NEW)
Capability: `hasInjectJS`

```
┌──────────────────────────────────────┐
│  (monospace textarea, ~8 rows)       │
└──────────────────────────────────────┘
[Run Script]
```

POST `/api/devices/[id]/inject-js` with `{ code }`.

### File Transfer section (NEW)
Capability: `hasFileTransfer`

```
ZIP URL: [_________________________________]
Target dir (optional): [__________________]
[Deploy ZIP]
```

POST `/api/devices/[id]/loadzip` with `{ url, dir? }`.

---

## New Tabs

### Camera tab
Condition: `hasCamshot === true`

```
[Capture]

┌─────────────────────────────────────────┐
│  <img> — JPEG from camshot endpoint     │
│  (placeholder until first capture)      │
└─────────────────────────────────────────┘
Last captured: <timestamp>
```

GET `/api/devices/[id]/camshot`.
Image stored as object URL in component state; revoked on unmount.
Error 422 shown as inline alert (not toast) because it requires user action.

### Logcat sub-tab (inside existing Logs tab)
Condition: `hasLogViewer === true`

Logs tab becomes a two-sub-tab layout:
- **Fully Log** — existing `GET /api/devices/[id]/logs`
- **Logcat** — new `GET /api/devices/[id]/logcat`

Both render in a `<pre>` block with auto-scroll-to-bottom and a Copy button.

### Device Settings tab
Condition: `hasAppManagement === true`

```
Search: [_____________]

┌──────────────────────────────────────────────────────────────┐
│  Key                    │  Value             │  Action        │
│  startUrl               │  https://…         │  [Edit]        │
│  screenBrightness       │  80                │  [Edit]        │
│  …                      │                    │                │
└──────────────────────────────────────────────────────────────┘
[Load Settings]

── Edit inline form (when Edit clicked) ──
Key: startUrl (read-only)
Type: [String ▾ | Boolean]
Value: [______________________]
[Save]  [Cancel]
```

GET `/api/devices/[id]/device-settings` on "Load Settings".
PUT `/api/devices/[id]/device-settings` on "Save".
Search filters rows client-side (no re-fetch).

---

## Shared UI patterns

### `useDeviceCommand` hook (extends existing pattern)
```ts
function useDeviceCommand(deviceId: string) {
  // Returns: { execute, loading, error }
  // execute(cmd, params?) → POST /api/devices/[id]/command
}
```
All sections reuse this hook or the direct fetch pattern already established in `DeviceControls`.

### Confirmation dialog
Reuse existing `ConfirmDialog` component for destructive actions:
- Force Sleep
- Exit App
- Enable/Disable Maintenance Mode
- Uninstall App

### Toast pattern
- Success: `toast.success("Done")`
- Error: `toast.error(response.error ?? "Unknown error")`

---

## File layout

```
components/
  DeviceControls.tsx         — extended with new accordion sections
  CamshotPanel.tsx           — new Camera tab content
  LogsPanel.tsx              — extended with Logcat sub-tab
  DeviceSettingsPanel.tsx    — new Device Settings tab content
  MediaControls.tsx          — Audio + Video section
  ApkManager.tsx             — APK install/uninstall/status section
  MaintenanceControls.tsx    — Maintenance mode + overlay section
  AppLauncherControls.tsx    — Launch app / intent section
  BrowserControls.tsx        — Clear cache/cookies, tab management
  JsInjector.tsx             — JavaScript injection section
  FileTransferControls.tsx   — ZIP deploy section
app/devices/[id]/page.tsx    — add new tabs, load new panels
```

All components are Client Components (`"use client"`). They receive `deviceId` and
`capabilities: ProviderCapabilities` as props from the Server Component page.

---

## Data flow summary

```
page.tsx (Server Component)
  └─ fetches device + capabilities server-side
  └─ renders DeviceDetailTabs (Client Component)
        ├─ Controls tab → DeviceControls (existing + new sections)
        ├─ Camera tab   → CamshotPanel
        ├─ Logs tab     → LogsPanel (Fully Log + Logcat)
        ├─ Device Settings tab → DeviceSettingsPanel
        └─ Files tab    → (existing FileManager)
```
