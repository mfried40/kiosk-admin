# 013 — MQTT Device Discovery: Requirements

## Overview

When an MQTT `deviceinfo` message arrives for a device that is not in the database, the system shall surface a dismissable prompt in the dashboard UI so the admin can add the device in one click with the form pre-filled from the MQTT payload.

---

## User Stories

### US-013-1: Detect unknown MQTT devices
As a system, I want to track devices that publish MQTT messages but are not yet registered, so that the admin can discover and add them without manually entering details.

**Acceptance criteria**
- WHEN a `deviceinfo` MQTT message arrives AND no device in the database matches `mqttDeviceId`, `deviceId` (payload), or `ip4` (payload), the system SHALL store the device information as an *unknown device* entry.
- The entry SHALL capture: `mqttDeviceId` (from topic), `deviceId` (from payload), `deviceName`, `ipAddress` (from `ip4`), `model`, and `seenAt` timestamp.
- IF an entry for the same `mqttDeviceId` already exists, the system SHALL update `seenAt` and any changed fields (e.g. IP address) rather than creating a duplicate.
- Unknown device entries SHALL be stored in-memory (cleared on server restart — devices republish automatically).

### US-013-2: View unknown devices in the dashboard
As an admin, I want to see a notification banner in the dashboard for each unregistered device that is broadcasting over MQTT, so that I am aware of devices that need to be added.

**Acceptance criteria**
- WHEN one or more unknown device entries exist, the dashboard SHALL display a collapsible notification section above the device grid labelled "Discovered via MQTT — not yet added".
- Each entry SHALL show: device name (or `mqttDeviceId` if name is unavailable), IP address, model, and time since first seen.
- The section SHALL update in real time via the existing SSE connection without a page reload.
- IF there are no unknown devices, the section SHALL not render.

### US-013-3: Add a discovered device in one click
As an admin, I want to click "Add" on a discovered device to open the Add Device form pre-filled with its details, so that I don't have to look up or type the IP address, port, and device ID manually.

**Acceptance criteria**
- WHEN the admin clicks "Add" on an unknown device entry, the system SHALL open the Add Device form with the following fields pre-populated:
  - **Name** — `deviceName` from the payload (editable)
  - **IP Address** — `ip4` from the payload
  - **Port** — default `2323` for Fully Kiosk
  - **Provider** — `FULLY_KIOSK` (defaulted; user can change)
  - **MQTT Device ID** — `deviceId` from the payload
- The admin SHALL be able to edit any field before saving.
- WHEN the device is successfully saved, the unknown device entry SHALL be automatically dismissed.

### US-013-4: Dismiss a discovered device
As an admin, I want to dismiss a discovered device without adding it, so that the notification doesn't keep reappearing for devices I intentionally choose not to register.

**Acceptance criteria**
- WHEN the admin clicks "Dismiss" on an unknown device entry, the system SHALL remove the entry from the in-memory store and from the UI.
- Dismissed entries SHALL reappear if a new MQTT message from that device arrives after the server restarts, since in-memory state is cleared.
- Dismissed entries SHALL NOT reappear during the same server session even if new MQTT messages arrive from that device (i.e. the dismissed `mqttDeviceId` is added to an ignore list for the session).

### US-013-5: Real-time delivery of discovery events
As a browser client, I want new unknown device discoveries to appear in the dashboard immediately via SSE, so that I don't need to reload the page.

**Acceptance criteria**
- WHEN a new unknown device entry is created or updated, the system SHALL broadcast an SSE event of type `unknown-device` with the entry payload.
- WHEN an unknown device entry is dismissed, the system SHALL broadcast an SSE event of type `unknown-device-dismissed` with `{ mqttDeviceId }`.
- The dashboard SHALL handle both event types and update the discovery section without a page reload.

---

## Non-functional Requirements
- Unknown device storage is in-memory only — no new database table required.
- The dismissed `mqttDeviceId` set persists only for the lifetime of the server process.
- Discovery detection must not block the MQTT message handler — updates are fire-and-forget.
- The discovery section must not appear for users with the VIEWER role (read-only; cannot add devices).

## Out of Scope
- Automatic provisioning of discovered devices without admin confirmation.
- Persistent dismissed list (survives server restart).
- Discovery of devices not connected to MQTT (HTTP-only devices).
