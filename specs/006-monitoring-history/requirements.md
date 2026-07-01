# 006 — Monitoring & Status History: Requirements

## User Stories

### US-006-1: Live screenshot
As an admin, I want to see a current screenshot of any device, so that I can visually verify what is displayed on screen.

**Acceptance criteria**
- WHEN a user opens a device detail page, the system SHALL request a screenshot via `GET /api/devices/[id]/screenshot`.
- WHEN the screenshot is fetched, the system SHALL display it as an `<img>` element refreshable on demand.
- IF the device is offline or the provider does not support screenshots (`hasScreenshot: false`), the system SHALL show a placeholder and SHALL NOT display an error crash.
- WHILE the screenshot is loading, the system SHALL show a skeleton placeholder of the same dimensions.

### US-006-2: Device status history
As an admin, I want to see a device's battery level and uptime trend over recent days, so that I can detect degrading hardware or connectivity issues.

**Acceptance criteria**
- The system shall record a `DeviceStatusHistory` row every time live device info is fetched and differs from the last recorded snapshot.
- WHEN `GET /api/devices/[id]/history` is called, the system SHALL return all history rows within the configured retention window, ordered by `recordedAt` ascending.
- WHEN the device detail page renders, the system SHALL display a battery trend line chart and an uptime bar chart using the history data.
- The system shall prune history rows older than the retention period on every new insert (delete-on-write). No background job is needed.

### US-006-3: Configurable retention period
As an admin, I want to set how many days of device history to retain, so that I can balance storage use against visibility.

**Acceptance criteria**
- WHEN an admin updates the retention setting in `/settings`, the system SHALL persist it in the app config.
- The default retention period is 7 days.
- WHEN a new history row is inserted, the system SHALL delete all rows for that device older than `NOW() - retentionDays`.

### US-006-4: Log viewer
As an admin, I want to view the Fully Kiosk device log or Android logcat, so that I can diagnose app crashes or connectivity problems.

**Acceptance criteria**
- WHERE the device provider has `hasLogViewer: true`, the device detail page SHALL show a "View Log" panel.
- WHEN a user opens the log panel, the system SHALL fetch the log via the provider's `getLogs(device)` method and display it in a scrollable monospace text area.
- IF the log fetch fails, the system SHALL show the error message inline in the panel.

### US-006-5: Usage statistics
As an admin, I want to download a CSV of device usage statistics, so that I can report on screen time or app usage.

**Acceptance criteria**
- WHERE the device provider has `hasUsageStats: true`, the device detail page SHALL show a "Download Usage CSV" button.
- WHEN a user clicks the button, the system SHALL call `?cmd=getUsageStats` and trigger a browser file download.

---

## Non-functional Requirements
- Screenshots are streamed as raw PNG buffers — never stored on the server.
- History rows are append-only. No update operations.
- The history API must support `?from=ISO8601&to=ISO8601` query params for the charting library.

## Out of Scope
- Storing screenshots for history / replay.
- Video streaming from the device camera.
