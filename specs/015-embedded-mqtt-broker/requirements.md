# 015 — Embedded MQTT Broker: Requirements

## Overview

Add an optional embedded MQTT broker (Aedes) that runs inside the Kiosk Admin Node.js process. The admin can switch between **embedded** and **external** broker modes from the Settings page at runtime — no environment variables, no custom server, no restart required. When embedded mode is active, devices connect directly to the Kiosk Admin server on a configurable port and no third-party broker is needed.

---

## User Stories

### US-015-1: Toggle embedded broker from Settings
As an admin, I want to switch between an embedded MQTT broker and an external one from the Settings page, so that I can go self-contained without editing environment variables or restarting the server.

**Acceptance criteria**
- The Settings → MQTT section SHALL offer two modes: **Embedded** and **External**.
- WHEN the admin selects **Embedded**, the system SHALL start an Aedes MQTT broker inside the running process on the configured port (default `1883`) and connect the server-side MQTT client to it automatically.
- WHEN the admin selects **External**, the system SHALL stop the embedded broker (if running) and connect using the broker URL, username, and password fields.
- The selected mode SHALL be persisted in the database so it survives server restarts.
- Switching mode SHALL take effect immediately without restarting the Next.js process.

### US-015-2: Configure the embedded broker port
As an admin, I want to configure which port the embedded broker listens on so that I can avoid conflicts with other services.

**Acceptance criteria**
- The Settings → MQTT section SHALL show a **Port** field (default `1883`) when Embedded mode is selected.
- WHEN the port is changed and saved, the system SHALL restart the embedded broker on the new port and reconnect the client.
- IF the port is already in use, the system SHALL return an error and keep the previous broker running.

### US-015-3: Optional authentication on the embedded broker
As an admin, I want to optionally require credentials for devices connecting to the embedded broker.

**Acceptance criteria**
- Optional **Broker Username** and **Broker Password** fields SHALL appear when Embedded mode is selected.
- WHEN credentials are set, the broker SHALL reject connections that do not match.
- WHEN credentials are blank, the broker SHALL accept anonymous connections.

### US-015-4: Show embedded broker status
As an admin, I want to see whether the embedded broker is running and how many clients are connected.

**Acceptance criteria**
- WHEN embedded mode is active, Settings SHALL show: port, running/stopped, and connected client count.
- Client count SHALL refresh every 5 seconds.

### US-015-5: Persist across restarts
As an admin, I want the embedded broker to start automatically after a server restart.

**Acceptance criteria**
- WHEN embedded mode is persisted in the DB, the system SHALL start the broker automatically on module load (same pattern as the existing MQTT auto-connect).

### US-015-6: No custom server required
As a developer, I want the embedded broker to work with standard `next dev` and `next start`.

**Acceptance criteria**
- The broker runs as a TCP server started from a module-level singleton (`lib/mqtt/broker.ts`).
- All existing `package.json` scripts remain unchanged.

---

## Non-functional Requirements
- Uses Aedes (`npm install aedes`).
- Singleton within the Node.js process — one instance at a time.
- Clean sessions only (no persistent subscriptions).

## Out of Scope
- TLS/SSL on the embedded MQTT port.
- MQTT ACL / per-topic authorization.
- WebSocket MQTT bridge.
- Horizontal scaling / clustering.
