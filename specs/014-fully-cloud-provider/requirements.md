# 014 — Fully Cloud Provider: Requirements

## Overview

Add **Fully Cloud** as a third provider option. Instead of calling the device's local REST API directly, Fully Cloud routes all commands and status reads through `https://api.fully-kiosk.com` using an account API key. This enables remote management of devices that are not on the local network and have no open firewall port — only a valid Fully Cloud subscription is needed.

---

## User Stories

### US-014-1: Add a Fully Cloud device
As an admin, I want to add a device that is managed via Fully Cloud so that I can control it without knowing its local IP address or opening any firewall ports.

**Acceptance criteria**
- WHEN the admin selects **Fully Cloud** as the provider, the Add/Edit Device form SHALL replace the **IP Address** field label with **Account Email** and the **Password** field label with **API Key**.
- The **Port** field SHALL be hidden for Fully Cloud devices.
- The **MQTT Device ID** field SHALL be replaced by a **Cloud Device ID** field (the Fully Cloud `devid`).
- WHEN the admin enters a valid Account Email and API Key and clicks **Fetch**, the system SHALL call `GET https://api.fully-kiosk.com/cloud/devices` and present a list of devices on that account to choose from, auto-populating the Cloud Device ID and Name.
- The system SHALL store credentials as: `ipAddress` = account email, `passwordEnc` = encrypted API key, `mqttDeviceId` = Fully Cloud device ID.

### US-014-2: Retrieve live device status via Fully Cloud
As an admin, I want the dashboard to show live status for Fully Cloud devices so that I have the same visibility as for local devices.

**Acceptance criteria**
- WHEN the system polls a Fully Cloud device, it SHALL call `GET https://api.fully-kiosk.com/cloud/devices?apiemail=...&apikey=...&devid=...`.
- The system SHALL map the heartbeat payload fields to `DeviceInfo` (battery, screenOn, currentUrl, model, etc.).
- IF the cloud API returns an error status, the system SHALL mark the device as offline.

### US-014-3: Send commands to a Fully Cloud device
As an admin, I want to send remote admin commands to a Fully Cloud device so that I can control it regardless of network location.

**Acceptance criteria**
- WHEN a command is dispatched for a Fully Cloud device, the system SHALL call `GET https://api.fully-kiosk.com/remote/?apiemail=...&apikey=...&devid=...&cmd=...&persistent=1`.
- The `persistent=1` parameter SHALL always be set so that commands are queued if the device is momentarily offline.
- The system SHALL support all commands that the Fully Kiosk local REST API supports (same `cmd` names and parameters).
- IF the response contains `"status":"Error"`, the system SHALL surface the `statustext` as an error.

### US-014-4: Capability parity with local Fully Kiosk
As an admin, I want Fully Cloud devices to show the same remote-control capabilities as local Fully Kiosk devices, since they run the same firmware.

**Acceptance criteria**
- The `FULLY_CLOUD` provider SHALL expose the same capability flags as `FULLY_KIOSK`, except:
  - `hasMqttCommands: false` (commands go via cloud, not MQTT)
- Screenshot and camshot are NOT available via the Fully Cloud API and SHALL be set to `false`.

### US-014-5: Rate-limit compliance
As a system, I want Fully Cloud API calls to respect the published rate limits so that the account is not blocked.

**Acceptance criteria**
- The system SHALL not exceed 10 requests per second or 100 requests per minute to `api.fully-kiosk.com`.
- WHERE multiple devices share the same account (same `apiemail`), the system SHALL serialise or throttle concurrent API calls.
- Rate-limit errors (HTTP 429) SHALL be retried after 1 second, up to 3 attempts.

### US-014-6: Flush the Fully Cloud action queue
As an admin, I want to flush the pending command queue for a Fully Cloud device so that stale queued commands are cancelled.

**Acceptance criteria**
- A **Flush Queue** action SHALL be available in the device detail page for Fully Cloud devices.
- WHEN the admin clicks Flush Queue, the system SHALL call `GET https://api.fully-kiosk.com/cloud/removeDeviceActions?apiemail=...&apikey=...&devid=...`.

---

## Non-functional Requirements
- All calls to `api.fully-kiosk.com` are server-side only — the API key is never sent to the browser.
- The account API key is stored encrypted with AES-256-GCM (same as device passwords).
- A single Fully Cloud account can manage multiple devices; each device record stores its own copy of the account credentials to keep the data model consistent with other providers.

## Out of Scope
- Screenshot and camshot via Fully Cloud (not supported by the cloud API).
- Real-time MQTT status updates for Fully Cloud devices (Fully Cloud uses polling only).
- Multi-account management (each device independently stores its account credentials).
