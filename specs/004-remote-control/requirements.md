# 004 — Remote Control: Requirements

## User Stories

### US-004-1: Send a command to a single device
As an admin, I want to send commands (screen on/off, load URL, restart app, etc.) to a single device, so that I can control it remotely without physical access.

**Acceptance criteria**
- WHEN an admin clicks a device control button, the system SHALL POST `{ cmd, params }` to `POST /api/devices/[id]/command`.
- WHEN the command succeeds, the system SHALL show a transient success toast.
- IF the command fails (provider error or device offline), the system SHALL show an error toast with the failure reason.
- WHILE the command is in flight, the system SHALL disable the button and show a loading indicator.

### US-004-2: Capability-gated controls
As any user, I want to only see controls that the device's provider actually supports, so that the UI is never cluttered with dead buttons.

**Acceptance criteria**
- WHEN a device detail page renders, the system SHALL load `ProviderCapabilities` for the device's provider and pass them as props to `DeviceControls`.
- WHERE a capability is `false`, the corresponding button SHALL not render — not just be disabled.
- IF a command is sent to a capability-unsupported route anyway (e.g. by direct HTTP), the system SHALL return `501 Not Implemented`.

### US-004-3: Bulk command to multiple devices
As an admin, I want to send the same command to many devices at once, so that I can roll out a change (e.g. load a new URL) across a fleet in one action.

**Acceptance criteria**
- WHEN an admin selects one or more devices on the dashboard and submits a bulk command, the system SHALL POST `{ cmd, params, deviceIds[] }` to `POST /api/devices/bulk/command`.
- The system SHALL send the command to each device in parallel and aggregate results.
- WHEN all commands succeed, the system SHALL show a summary toast: "Command sent to N devices".
- WHEN some commands fail, the system SHALL show which device IDs failed and why.
- IF any `deviceId` in the bulk request belongs to a different provider than the others, the system SHALL return `400 Bad Request` — bulk commands require a homogeneous provider set.

### US-004-4: Supported commands (Fully Kiosk)
The following commands must be available for Fully Kiosk devices:

| Command | `cmd` value | Notes |
|---|---|---|
| Screen on | `screenOn` | |
| Screen off | `screenOff` | |
| Load URL | `loadUrl` | params: `url` |
| Reload start URL | `reloadStartUrl` | |
| Restart kiosk app | `restartApp` | |
| Lock kiosk | `lockKiosk` | |
| Unlock kiosk | `unlockKiosk` | params: `password` |
| Start screensaver | `startScreensaver` | capability: `hasScreensaver` |
| Stop screensaver | `stopScreensaver` | capability: `hasScreensaver` |
| Text-to-speech | `textToSpeech` | params: `text`, `locale?`; capability: `hasTTS` |
| Set volume | `setVolume` | params: `level` (0–100) |
| Trigger motion | `triggerMotion` | |

**Acceptance criteria**
- WHERE the device is Fully Kiosk, all commands in the table above SHALL be available and SHALL map to the corresponding Fully Kiosk REST `cmd` value.
- IF `setVolume` is called with a level outside 0–100, the system SHALL return `400` without forwarding to the device.

---

## Non-functional Requirements
- Bulk command parallelism shall use `Promise.allSettled` — one device failure must not block others.
- Command endpoint must audit-log every call (see spec 008).

## Out of Scope
- Scheduling a command for a future time.
- Queuing commands for offline devices (fire-and-forget only).
