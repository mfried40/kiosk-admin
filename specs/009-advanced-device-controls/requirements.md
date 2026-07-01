# 009 — Advanced Device Controls: Requirements

## Context
Spec 004 delivered basic remote control (screen, URL, restart, kiosk lock, screensaver, TTS, volume).
This spec extends the device detail page with every additional capability exposed by the Fully Kiosk REST API.
All API routes are already implemented; this spec governs the UI panels that surface them.

---

## User Stories

### US-009-1: Camera snapshot (camshot)
As an admin, I want to see a live image from the device's front camera, so that I can visually verify what is happening on-site without calling a technician.

**Acceptance criteria**
- WHEN the device detail page loads and `hasCamshot` is `true`, the system SHALL render a "Camera" tab/panel.
- WHEN the admin clicks "Capture", the system SHALL GET `/api/devices/[id]/camshot` and display the returned JPEG inline.
- IF the response is `422`, the system SHALL show: "Enable motion detection in Fully Kiosk Remote Admin settings".
- IF the response is `503`, the system SHALL show an error toast "Device offline".
- WHILE the capture is in progress, the button SHALL be disabled with a spinner.

### US-009-2: Android Logcat
As an admin, I want to view the Android system log (logcat), so that I can diagnose crashes and errors on the device without physical access.

**Acceptance criteria**
- WHEN `hasLogViewer` is `true`, the device Logs panel SHALL show two tabs: "Fully Log" and "Logcat".
- WHEN the admin selects the "Logcat" tab, the system SHALL GET `/api/devices/[id]/logcat` and render the text in a scrollable, monospace code block.
- The system SHALL provide a "Copy to clipboard" button for the log content.
- WHEN a new log is fetched, the view SHALL auto-scroll to the bottom.

### US-009-3: Browser tab management
As an admin, I want to focus, close, or refresh individual browser tabs on the device, so that I can manage multi-page kiosk flows remotely.

**Acceptance criteria**
- WHEN `hasTabManagement` is `true`, a "Tabs" section SHALL appear in DeviceControls.
- The section SHALL offer:
  - A "Refresh" button that POSTs `{ action: "refresh" }` to `/api/devices/[id]/tabs`.
  - A numeric input for tab index plus "Focus" and "Close" buttons.
- IF the tab index is negative, the "Focus" and "Close" buttons SHALL be disabled.
- On success, a toast SHALL confirm the action.

### US-009-4: Web cache / storage clearing
As an admin, I want to clear the browser cache, cookies, or web storage on a device, so that I can fix stale-data issues without physically accessing it.

**Acceptance criteria**
- WHEN `hasUrlControl` is `true`, a "Clear" section SHALL appear in DeviceControls with three buttons: "Clear Cache", "Clear Cookies", "Clear Web Storage".
- Each button SHALL POST `{ cmd: "clearCache" | "clearCookies" | "clearWebstorage" }` to `/api/devices/[id]/command`.
- On success the system SHALL show a toast confirmation.

### US-009-5: JavaScript injection
As an admin, I want to inject JavaScript into the currently loaded page on a device, so that I can apply runtime fixes or trigger custom actions without redeploying content.

**Acceptance criteria**
- WHEN `hasInjectJS` is `true`, an "Inject JS" section SHALL appear in DeviceControls.
- The section SHALL render a multi-line code editor (a `<textarea>` with monospace font) and a "Run" button.
- The "Run" button SHALL be disabled when the textarea is empty.
- WHEN the admin clicks "Run", the system SHALL POST `{ code }` to `/api/devices/[id]/inject-js`.
- On success, the system SHALL show a toast "Script injected".
- On error, the system SHALL show the error message from the API response.

### US-009-6: Overlay message
As an admin, I want to display a custom on-screen overlay message on a device, so that I can communicate status or warnings to nearby users.

**Acceptance criteria**
- WHEN `hasMaintenance` is `true`, a "Maintenance" section SHALL appear in DeviceControls.
- The section SHALL contain:
  - A text input (max 500 characters) for the overlay message.
  - A "Show Overlay" button.
  - A "Clear Overlay" button that sends `{ text: "" }` to clear the message.
- WHEN the text input is empty, "Show Overlay" SHALL be disabled.

### US-009-7: Maintenance (locked) mode
As an admin, I want to enable and disable maintenance mode on a device, so that I can prevent user interaction while servicing the device remotely.

**Acceptance criteria**
- WHEN `hasMaintenance` is `true`, the Maintenance section (US-009-6) SHALL also contain:
  - An "Enable Maintenance Mode" button that POSTs `{ action: "enable" }` to `/api/devices/[id]/maintenance`.
  - A "Disable Maintenance Mode" button that POSTs `{ action: "disable" }`.
- Both buttons SHALL show a confirmation dialog before sending ("Are you sure?").

### US-009-8: App launcher
As an admin, I want to start any installed app or Android intent on a device, so that I can trigger specific actions without physically touching the device.

**Acceptance criteria**
- WHEN `hasAppLauncher` is `true`, an "App Launcher" section SHALL appear in DeviceControls.
- The section SHALL contain:
  - A package name input + "Launch App" button → POST `{ cmd: "startApplication", params: { package } }`.
  - An intent URL input + "Start Intent" button → POST `{ cmd: "startIntent", params: { url } }`.
  - "Bring to Foreground" button → POST `{ cmd: "toForeground" }`.
  - "Send to Background" button → POST `{ cmd: "toBackground" }`.
  - "Exit App" button (with confirmation dialog) → POST `{ cmd: "exitApp" }`.
- Package and intent inputs SHALL be non-empty for their respective buttons to be enabled.

### US-009-9: Media player
As an admin, I want to play audio or video content on a device from a remote URL, so that I can broadcast announcements or display content on demand.

**Acceptance criteria**
- WHEN `hasMediaPlayer` is `true`, a "Media" section SHALL appear in DeviceControls.
- The section SHALL contain:
  - A URL input + "Play Sound" button with optional loop toggle → POST to `/api/devices/[id]/media` with `action: "playSound"`.
  - A "Stop Sound" button.
  - A URL input + "Play Video" button with toggles for: loop, show controls, exit on touch, exit on completion → POST with `action: "playVideo"`.
  - A "Stop Video" button.
- URL inputs SHALL be validated as non-empty before enabling their play buttons.

### US-009-10: APK management
As an admin, I want to install and uninstall apps on a device from URLs, so that I can deploy or roll back kiosk software without physical access.

**Acceptance criteria**
- WHEN `hasApkManagement` is `true`, an "APK Manager" section SHALL appear in DeviceControls.
- The section SHALL contain:
  - A URL input + "Force Install" toggle + "Install APK" button → POST to `/api/devices/[id]/apk`.
  - A package name input + "Uninstall App" button (with confirmation) → DELETE to `/api/devices/[id]/apk`.
  - A "Check Install Status" button → GET `/api/devices/[id]/apk`, displays JSON result inline.
- The "Install APK" button SHALL require a valid URL in the input.
- The "Uninstall App" button SHALL require a non-empty package name.

### US-009-11: ZIP file transfer
As an admin, I want to push a ZIP archive to a device from a URL so that device storage can be populated remotely.

**Acceptance criteria**
- WHEN `hasFileTransfer` is `true`, a "File Transfer" section SHALL appear in DeviceControls.
- The section SHALL contain a URL input, an optional target directory input, and a "Deploy ZIP" button.
- The "Deploy ZIP" button SHALL POST `{ url, dir? }` to `/api/devices/[id]/loadzip`.
- The URL field SHALL be validated as a proper URL before enabling the button.

### US-009-12: Device settings explorer
As an admin, I want to read and write individual Fully Kiosk settings directly on a device, so that I can tune device behaviour without navigating the Fully Kiosk UI locally.

**Acceptance criteria**
- WHEN `hasAppManagement` is `true`, a "Device Settings" tab/panel SHALL be available on the device detail page.
- WHEN the tab is opened, the system SHALL GET `/api/devices/[id]/device-settings` and display a searchable, paginated table with columns: Key, Value, Edit.
- WHEN an admin clicks "Edit" on a row, an inline form SHALL appear with the current value pre-filled and a type selector (string / boolean).
- WHEN the admin saves, the system SHALL PUT `{ type, key, value }` to `/api/devices/[id]/device-settings`.
- On success the updated row SHALL reflect the new value without a full page reload.
- The search input SHALL filter rows client-side by key name.

### US-009-13: Daydream / screensaver additional commands
As an admin, I want to start and stop Android Daydream (interactive screensaver) separately from the standard Fully screensaver.

**Acceptance criteria**
- WHEN `hasScreensaver` is `true`, the existing Screensaver section SHALL add two more buttons: "Start Daydream" and "Stop Daydream".
- Each SHALL POST the appropriate `cmd` (`startDaydream` / `stopDaydream`) to `/api/devices/[id]/command`.

### US-009-14: Force sleep
As an admin, I want to force the device into deep sleep so that the screen and background processes are fully suspended.

**Acceptance criteria**
- WHEN `hasScreenControl` is `true`, the existing Power section SHALL add a "Force Sleep" button.
- It SHALL POST `{ cmd: "forceSleep" }` to `/api/devices/[id]/command`.
- A confirmation dialog SHALL appear before sending.

---

## Non-functional Requirements
- All new UI sections SHALL be lazy-loaded (accordion / expandable) so the device detail page does not become unmanageably long.
- Every interactive control SHALL follow the existing loading state + toast pattern from spec 004.
- No new npm dependencies SHALL be added unless strictly necessary.

## Out of Scope
- Root commands (`runRootCommand`, `shutdownDevice`, `rebootDevice`) — destructive and rooted-device-only; deferred.
- `killMyProcess` — edge case; reachable via generic command route already.
- Video Kiosk player controls (`playerStart`, `playerStop`, etc.) — separate product line.
- Bulk variants of the new endpoints (media, APK, inject-js) — deferred.
