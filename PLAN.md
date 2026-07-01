## Kiosk Admin Implementation Plan

This is a implementation plan for the new kiosk-admin project, an app to manage multiple kiosk-managed devices from a central admin panel.

The app is designed to support multiple kiosk software providers (e.g. Fully Kiosk, Free Kiosk) via a provider abstraction layer. Each provider implements a common interface so the UI and API routes remain provider-agnostic.

---

### Stack

#### Front End
- Next.js (App Router)
- Shadcn/ui + Tailwind CSS

#### Testing
- Vitest (unit + integration specs)
- @testing-library/react (component specs)
- Playwright (e2e specs)
- msw (mock service worker — stubs device REST calls in specs)

#### Backend
- Next.js API Routes (same project)
- SQLite (default, zero-config local database)
- PostgreSQL or MongoDB (optional, set `DATABASE_URL` env var to switch)
- Prisma (ORM — supports SQLite, PostgreSQL, and MongoDB)
- NextAuth.js (authentication)
- MQTT (optional real-time device events via a shared broker)

---

### Data Model

#### Device
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| name | string | friendly alias |
| ipAddress | string | device IP or hostname |
| port | int | provider default applied if omitted |
| password | string | Remote Admin password (encrypted at rest) |
| provider | enum | `FULLY_KIOSK` \| `FREE_KIOSK` \| ... |
| mqttDeviceId | string? | device ID used in MQTT topics |
| groupId | uuid? | optional group assignment |
| createdAt | datetime | |
| updatedAt | datetime | |

#### MqttConfig (global, one row)
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| brokerUrl | string | e.g. `mqtt://broker:1883` or `ssl://...` |
| username | string? | |
| password | string? | encrypted at rest |
| topicPrefix | string | default: `fully` (matches Fully Kiosk default) |

#### Tag
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| name | string | unique label e.g. `floor-2`, `pos-terminal` |

#### DeviceTag (join)
| Field | Type | Notes |
|---|---|---|
| deviceId | uuid | |
| tagId | uuid | |

#### DeviceStatusHistory
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| deviceId | uuid | |
| online | boolean | |
| batteryLevel | float? | |
| currentUrl | string? | |
| screenOn | boolean? | |
| recordedAt | datetime | indexed |

Rows older than the configured retention period are pruned by a cleanup routine triggered on each new insert (delete-on-write). No separate cron job is required.

#### ConfigTemplate
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| name | string | friendly label |
| provider | enum | must match target device provider |
| settings | json | key/value settings snapshot |
| createdAt | datetime | |

#### AuditLog
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| userId | uuid | who performed the action |
| deviceId | uuid? | target device (null for bulk/global) |
| action | string | e.g. `sendCommand`, `updateSetting`, `applyTemplate` |
| payload | json? | command name + params |
| createdAt | datetime | indexed |

#### Group
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| name | string | group label |
| description | string? | |

#### User (admin accounts)
| Field | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| email | string | unique |
| passwordHash | string | |
| role | enum | ADMIN \| VIEWER |

---

### Provider Abstraction

Each kiosk provider is implemented as a class that satisfies a shared `KioskProvider` interface:

```ts
interface KioskProvider {
  getDeviceInfo(device: Device): Promise<DeviceInfo>
  getScreenshot(device: Device): Promise<Buffer>
  sendCommand(device: Device, cmd: string, params?: Record<string, string>): Promise<unknown>
  getSettings(device: Device): Promise<Record<string, string>>
  setSetting(device: Device, key: string, value: string): Promise<void>
}

// Capabilities are static per provider class, not per instance.
// The UI reads these before rendering controls.
abstract class BaseKioskProvider implements KioskProvider {
  static readonly capabilities: ProviderCapabilities
  // ...
}
```

Capabilities (boolean flags) tell the UI which features to show for a given provider, e.g. `hasScreensaver`, `hasFileManagement`, `hasAppManagement`, `hasUsageStats`. They are declared as `static readonly` on each provider class so they can be read without instantiating a provider.

Providers live in `lib/providers/` and are resolved at runtime by the device's `provider` field.

| Provider | Default Port | Notes |
|---|---|---|
| Fully Kiosk | 2323 | Full feature set |
| Free Kiosk | TBD | Implement once REST API is documented |

---

### Features

#### Device Management
- Add / edit / remove devices (select provider when adding)
- Organise devices into groups (mixed providers allowed)
- View live device status (online/offline, battery, current URL, screen state)
- View device info (IP, model, Android version, app version, storage)

#### Remote Control (per device or bulk)
- Screen on / off
- Load URL
- Reload Start URL
- Restart kiosk app
- Lock / unlock kiosk
- Start / stop screensaver
- Text-to-speech
- Set audio volume
- Play sound / video
- Trigger motion
- Controls are gated by provider capabilities – unsupported actions are hidden

#### Settings Management
- View all settings for a device (provider-specific)
- Edit individual settings (boolean / string)
- Import settings from JSON file URL (where supported)
- Push same settings to multiple devices of the same provider (bulk)

#### Screenshots & Monitoring
- Live screenshot per device
- Camshot (if motion detection enabled)
- View Fully log / Android logcat
- Usage statistics (CSV download)

#### Real-time Events via MQTT (optional)
When a broker is configured, the server subscribes to device topics and pushes updates to the browser via Server-Sent Events (SSE).

- **Device info topic** (`fully/deviceInfo/$deviceId`) — received every 60 s; updates battery, screen state, current URL in real-time
- **Event topics** (`fully/event/$event/$deviceId`) — instant dashboard updates for:
  - `screenOn` / `screenOff`
  - `networkDisconnect` / `networkReconnect`
  - `unplugged` / `pluggedAC`
  - `onBatteryLevelChanged`
  - `onMotion`, `kioskLocked` / `kioskUnlocked`, etc.
- Falls back gracefully to HTTP polling when MQTT is not configured
- SSE endpoint: `GET /api/events` — browser subscribes for live push updates

#### File Management
- Load and unzip content from ZIP URL to device
- Download / delete local files on device

#### App Management
- View installed apps
- Install APK from URL (provisioned devices)
- Uninstall apps

#### Device Tags
- Free-form tags on devices (e.g. `floor-2`, `pos-terminal`, `retail`)
- Filter dashboard and groups by tag
- Apply bulk commands to all devices matching a tag

#### Config Templates
- Save a named snapshot of settings for a provider
- Apply a template to one or many devices in one click
- Templates are provider-scoped (can't apply a Fully Kiosk template to a Free Kiosk device)

#### Alerting
- In-app notification when a device goes offline, battery drops below a threshold, or power is disconnected
- Triggered by MQTT events when broker is configured, or detected via polling otherwise
- Optional email alert (configurable SMTP settings)

#### Device Status History
- Periodic snapshots of battery, screen state, and current URL stored in `DeviceStatusHistory`
- Uptime graph and battery trend visible on device detail page
- Configurable retention period (default: 7 days)

#### Audit Log
- Every command sent, setting changed, or template applied is recorded with user, timestamp, and payload
- Visible to ADMIN users on the device detail page and a global log page

#### First-run Onboarding
- On first boot (no users in DB), redirect to `/setup` to create the initial admin account
- Subsequent visits skip setup and go straight to login

---

### API Routes

All device commands are proxied through Next.js API routes to avoid exposing device credentials to the browser and to centralise auth.

```
# Devices
GET    /api/devices                   – list all devices with status
POST   /api/devices                   – add a device
PUT    /api/devices/[id]              – update device
DELETE /api/devices/[id]              – remove device
GET    /api/devices/[id]/info         – fetch live device info
GET    /api/devices/[id]/screenshot   – proxy screenshot PNG
POST   /api/devices/[id]/command      – send REST command { cmd, params }
GET    /api/devices/[id]/history      – status history for graphs
POST   /api/devices/bulk/command      – send command to multiple devices

# Groups
GET    /api/groups                    – list groups
POST   /api/groups                    – create group
PUT    /api/groups/[id]               – update group
DELETE /api/groups/[id]               – remove group

# Tags
GET    /api/tags                      – list all tags
POST   /api/tags                      – create tag
DELETE /api/tags/[id]                 – remove tag
POST   /api/devices/[id]/tags         – assign tags to device

# Config Templates
GET    /api/templates                 – list templates
POST   /api/templates                 – create template
PUT    /api/templates/[id]            – update template
DELETE /api/templates/[id]            – remove template
POST   /api/templates/[id]/apply      – apply template to { deviceIds[] }

# Audit Log
GET    /api/audit                     – list audit entries (paginated)

# Alerts
GET    /api/alerts                    – list alert rules
POST   /api/alerts                    – create alert rule
PUT    /api/alerts/[id]               – update alert rule
DELETE /api/alerts/[id]               – remove alert rule

# SSE
GET    /api/events                    – Server-Sent Events stream for live updates

# Settings (app config)
GET    /api/config                    – get app config (MQTT, SMTP, retention)
PUT    /api/config                    – update app config
```

---

### Pages / UI

| Route | Description |
|---|---|
| `/` | Dashboard – grid/list of all devices with live status |
| `/devices/[id]` | Device detail – info, controls, screenshot, settings, log, history |
| `/devices/[id]/settings` | Browse and edit all settings (provider-specific) |
| `/groups/[id]` | Group view with bulk action controls |
| `/groups` | Group management |
| `/templates` | Config template library |
| `/audit` | Global audit log |
| `/setup` | First-run onboarding (hidden once admin exists) |
| `/settings` | App configuration (SMTP, MQTT, retention) |

---

### Security Considerations

- Device passwords are encrypted at rest (AES-256 via a server-side secret)
- All device API calls are made server-side; credentials never reach the browser
- Admin UI protected by NextAuth.js session (credentials or OAuth)
- Role-based access: VIEWER can only read/screenshot; ADMIN can send commands
- API routes validate session before proxying any command

---

### Project Structure

```
kiosk-admin/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── setup/            – first-run onboarding
│   ├── dashboard/
│   ├── devices/
│   │   └── [id]/
│   ├── groups/
│   ├── templates/
│   └── audit/
├── components/
│   ├── device-card.tsx
│   ├── device-controls.tsx
│   └── settings-editor.tsx
├── lib/
│   ├── providers/
│   │   ├── index.ts          – resolves provider by device.provider enum
│   │   ├── fully-kiosk.ts    – Fully Kiosk REST API implementation
│   │   └── free-kiosk.ts     – Free Kiosk implementation (stub)
│   ├── mqtt/
│   │   ├── client.ts         – singleton MQTT client (mqtt.js)
│   │   ├── handlers.ts       – maps incoming topics to DB / SSE updates
│   │   └── sse.ts            – Server-Sent Events broadcaster
│   ├── alerts.ts             – alert rules evaluation + email dispatch
│   ├── audit.ts              – helper to write AuditLog entries
│   ├── provider.types.ts     – KioskProvider interface + capability types
│   ├── crypto.ts             – encrypt/decrypt device passwords
│   └── db.ts                 – Prisma client singleton
├── prisma/
│   └── schema.prisma
├── .env.example
└── app/api/
    ├── devices/
    └── groups/
```

---

### Environment Variables

```
# Required
NEXTAUTH_SECRET=        – random secret for session signing
NEXTAUTH_URL=           – public base URL (e.g. http://localhost:3000)
ENCRYPTION_SECRET=      – 32-byte secret for AES-256 device password encryption

# Database (optional – defaults to local SQLite dev.db)
# DATABASE_PROVIDER: sqlite (default) | postgresql | mongodb
DATABASE_PROVIDER=
# PostgreSQL:  DATABASE_URL="postgresql://user:pass@host:5432/db"
# MongoDB:     DATABASE_URL="mongodb+srv://user:pass@cluster/db"
DATABASE_URL=

# MQTT (optional)
MQTT_BROKER_URL=        – e.g. mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Email alerts (optional)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
ALERT_FROM_EMAIL=
```

> **Database notes**
> - **SQLite** — default; uses file `dev.db`, no setup required. Not recommended for multi-instance deployments.
> - **PostgreSQL** — full migration support via `prisma migrate`.
> - **MongoDB** — supported via Prisma's MongoDB connector. Requires a replica set (Atlas or a local replica set — standalone `mongod` is not supported by Prisma). Uses `db push` instead of `migrate`. IDs must use `@db.ObjectId` and `@default(auto())` instead of `@default(uuid())`. The `schema.prisma` will use a `DATABASE_PROVIDER` env var (default `sqlite`) to switch the datasource provider and ID field types accordingly. A separate `schema.mongo.prisma` will be maintained for MongoDB to avoid incompatible directives in a single schema file.

---

### Implementation Order

1. Project scaffold (Next.js + Shadcn + Prisma + SQLite default) + `.env.example`
2. First-run onboarding (`/setup` route, redirects when no users exist)
3. Auth (NextAuth.js with credentials provider)
4. Device CRUD + database schema — `schema.prisma` (SQLite/PostgreSQL) and `schema.mongo.prisma` (MongoDB), covering all models
5. `provider.types.ts` – `KioskProvider` interface, `BaseKioskProvider` abstract class, and static capability flags
6. `fully-kiosk.ts` – Fully Kiosk provider implementation
7. `free-kiosk.ts` – Free Kiosk provider stub (expand when API is known)
8. Provider resolver `providers/index.ts`
9.  Dashboard page with live device status (HTTP polling fallback)
10. Device detail page – info, screenshot, basic controls (capability-gated)
11. Settings viewer/editor
12. MQTT client + topic handlers + SSE broadcaster
13. Wire SSE into dashboard for real-time updates
14. Device status history + uptime/battery graphs (with delete-on-write pruning)
15. Alerting (MQTT events + polling fallback, optional email)
16. Audit log (`audit.ts` helper + `/audit` page)
17. Config templates
18. Device tags + tag-based filtering and bulk actions
19. Bulk actions (groups, same-provider devices)
20. File management + APK install
21. Log viewer