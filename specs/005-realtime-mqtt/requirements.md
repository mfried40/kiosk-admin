# 005 — Real-time & MQTT: Requirements

## User Stories

### US-005-1: Live dashboard without MQTT
As an admin, I want device statuses to refresh automatically even without a message broker, so that the dashboard shows reasonably up-to-date information.

**Acceptance criteria**
- WHERE MQTT is not configured, the dashboard SHALL poll `GET /api/devices` every 30 seconds.
- WHEN a poll completes, the system SHALL update device cards in place without a full page reload.
- IF a poll request fails (network error), the system SHALL silently retry on the next interval and SHALL NOT show an error to the user unless three consecutive polls fail.

### US-005-2: MQTT broker configuration
As an admin, I want to configure an MQTT broker from the settings page, so that I can enable real-time device events.

**Acceptance criteria**
- WHEN an admin saves MQTT settings (broker URL, optional username/password, topic prefix), the system SHALL persist them in the `MqttConfig` table, encrypting the password.
- WHEN the configuration is saved, the system SHALL attempt to connect the server-side MQTT client immediately.
- IF the connection attempt fails, the system SHALL surface the broker error in the settings UI and SHALL NOT mark MQTT as active.
- WHEN an admin clears the broker URL, the system SHALL disconnect the MQTT client and fall back to polling.

### US-005-3: Real-time device status via MQTT
As an admin, I want device cards to update instantly when the broker delivers a device event, so that I don't have to wait for a poll cycle.

**Acceptance criteria**
- WHERE MQTT is configured and connected, the system SHALL subscribe to `{prefix}/deviceInfo/{mqttDeviceId}` and `{prefix}/event/+/{mqttDeviceId}` for each device that has a `mqttDeviceId`.
- WHEN a `deviceInfo` message arrives, the system SHALL update the device's status in the database and push the change to all connected SSE clients.
- WHEN an event topic message arrives (`screenOn`, `screenOff`, `networkDisconnect`, `networkReconnect`, `unplugged`, `pluggedAC`, `onBatteryLevelChanged`, `onMotion`, `kioskLocked`, `kioskUnlocked`), the system SHALL update the relevant device status fields and push to SSE.
- WHERE MQTT is configured, the system SHALL NOT poll for devices that have a `mqttDeviceId`.

### US-005-4: Server-Sent Events stream
As a browser client, I want a persistent SSE connection that delivers real-time updates, so that I don't need to poll.

**Acceptance criteria**
- WHEN a browser connects to `GET /api/events`, the system SHALL keep the connection open and send events as they arrive from MQTT handlers.
- WHEN a device status changes, the system SHALL send an SSE event of type `device-update` with `{ deviceId, ...changedFields }` as the data payload.
- IF a browser disconnects, the system SHALL remove the client from the broadcaster and SHALL NOT leak the connection.
- WHERE MQTT is not configured, the SSE stream SHALL remain open but SHALL not emit any events (browser falls back to polling per US-005-1).

### US-005-5: MQTT command routing for cross-network devices
As an admin, I want commands sent to a device that is on a different network to be routed through the MQTT broker, so that I can control devices without port forwarding or a VPN.

**Acceptance criteria**
- WHEN a command is dispatched for a device that has `mqttDeviceId` set AND the MQTT broker is connected, the system SHALL publish the command to `{prefix}/cmd/{mqttDeviceId}` as a JSON payload instead of calling the device REST API directly.
- The command payload SHALL be a JSON object `{ "cmd": "<command>", ...params }` matching the Fully Kiosk REST parameter names.
- The system SHALL return `{ ok: true, transport: "mqtt" }` immediately after a successful broker publish — it SHALL NOT wait for device acknowledgement (fire-and-forget).
- The system SHALL still write the audit log entry on successful publish.
- IF the broker publish fails (broker dropped, QoS error), the system SHALL return HTTP 502 with an error message.

### US-005-6: HTTP fallback when MQTT is unavailable
As an admin, I want commands to fall back to direct HTTP when the broker is down, so that devices on the local network remain controllable without reconfiguring anything.

**Acceptance criteria**
- WHEN a device has `mqttDeviceId` set BUT the broker is not connected, the system SHALL fall back to the provider's direct HTTP `sendCommand` if `ipAddress` is set.
- WHEN a device has no `mqttDeviceId`, the system SHALL always use direct HTTP regardless of broker state.
- The `transport` field in the response SHALL reflect which path was taken: `"mqtt"` or `"http"`.

---

## Non-functional Requirements
- The MQTT client is a server-side singleton — one connection per server process regardless of how many browser tabs are open.
- MQTT topic prefix defaults to `fully` to match Fully Kiosk's default.
- SSE connections must have a keep-alive comment sent every 25 seconds to prevent proxy timeouts.
- MQTT command publish is fire-and-forget (QoS 0). The broker ACKs delivery to itself, not to the device.

## Out of Scope
- WebSockets (SSE is sufficient for unidirectional push).
- Persistent event storage (MQTT events trigger DB writes and SSE pushes; they are not queued).
- MQTT command acknowledgement / response from device (no two-way MQTT handshake).
