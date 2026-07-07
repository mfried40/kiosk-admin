# Kiosk Admin

A self-hosted web dashboard for managing a fleet of Android kiosk devices. Monitor status, send remote commands, and configure devices — all from one place.

Supports **Fully Kiosk Browser**, **FreeKiosk**, and **Fully Cloud** out of the box. Adding a new provider requires only a single new class.

---

## Features

- **Live device overview** — battery, screen state, current URL, online/offline history updated in real time
- **Remote control** — screen on/off, URL navigation, restart, screensaver, TTS, volume, JS injection, D-pad remote, and more
- **Device settings** — read and write all Fully Kiosk settings from the browser (categorised, searchable, auto-saved)
- **Multi-provider** — Fully Kiosk, FreeKiosk, and Fully Cloud share the same UI; capability flags hide controls unsupported by a given provider
- **Bulk actions** — send a command to all selected devices at once
- **Groups & tags** — organise devices for filtering and bulk targeting
- **Config templates** — save and apply setting presets across devices of the same provider
- **Alert rules** — email notifications for offline, low battery, and unplugged events
- **Audit log** — every command is logged with user, device, and timestamp
- **MQTT + SSE** — live status updates; built-in embedded broker (no external broker needed) or connect to any external broker; 30-second polling fallback
- **MQTT device discovery** — unregistered devices broadcasting over MQTT appear as a banner; add them in one click with fields pre-filled
- **Cross-network devices** — route commands through MQTT for devices behind NAT (no port forwarding needed)
- **Role-based access** — ADMIN (full control) and VIEWER (read-only + screenshots)
- **Zero-config default** — SQLite out of the box; switch to PostgreSQL or MongoDB via env var

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Shadcn/ui, Tailwind CSS v4 |
| Auth | NextAuth v5 (JWT, bcrypt) |
| Database | Prisma v7 — SQLite / PostgreSQL / MongoDB |
| Encryption | AES-256-GCM (Node.js `crypto`) |
| Embedded broker | Aedes (optional, runtime toggle in Settings) |
| Testing | Vitest, Playwright (e2e) |

---

## Getting started

### Prerequisites
- Node.js 20 LTS

### Install & run

```bash
cd kiosk-admin
npm install
cp .env.example .env   # fill in AUTH_SECRET and ENCRYPTION_SECRET
npx prisma migrate dev
npm run dev            # http://localhost:3000
```

Visit `http://localhost:3000/setup` to create the first admin account.

### Environment variables

```ini
# Required
AUTH_SECRET=<random 32+ char string>
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=1                    # required when running behind a reverse proxy
ENCRYPTION_SECRET=<64 hex chars>     # device passwords encrypted at rest

# Database (defaults to local SQLite)
DATABASE_PROVIDER=sqlite             # sqlite | postgresql | mongodb
DATABASE_URL=file:./prisma/dev.db

# Optional — can also be configured from the Settings page
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

Generate `ENCRYPTION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Common commands

All commands must be run from the `kiosk-admin/` directory.

```bash
npm run dev              # dev server (Turbopack) on :3000
npm run build            # production build
npm run lint             # ESLint
npx tsc --noEmit        # type-check
npm test                 # Vitest unit tests

# Prisma
npx prisma migrate dev --name <name>   # create + apply migration (SQLite / PG)
npx prisma migrate deploy              # apply migrations on a deployed server
npx prisma db push                     # sync schema without migration (MongoDB)
npx prisma generate                    # regenerate client after schema changes
npx prisma studio                      # browse the database
```

---

## Supported providers

| Capability | Fully Kiosk | FreeKiosk | Fully Cloud |
|---|:---:|:---:|:---:|
| Screenshot | ✅ | ✅ | ❌ |
| Screen on/off | ✅ | ✅ | ✅ |
| URL navigation & reload | ✅ | ✅ | ✅ |
| App restart | ✅ | ✅ | ✅ |
| Screensaver control | ✅ | ✅ | ✅ |
| Text-to-speech | ✅ | ✅ | ✅ |
| Volume control | ✅ | ✅ | ✅ |
| Camera capture | ✅ | ✅ | ❌ |
| Audio / media playback | ✅ | ✅ | ✅ |
| Maintenance (reboot, lock) | ✅ | ✅ | ✅ |
| App launcher | ✅ | ✅ | ✅ |
| JavaScript injection | ✅ | ✅ | ✅ |
| D-pad remote control | ❌ | ✅ | ❌ |
| Kiosk lock | ✅ | ✅ | ✅ |
| Device settings API | ✅ | ❌ | ❌ |
| File management | ✅ | ❌ | ❌ |
| APK install / uninstall | ✅ | ❌ | ❌ |
| Tab management | ✅ | ❌ | ❌ |
| Log viewer | ✅ | ❌ | ❌ |
| MQTT commands | ❌ | ✅ | ❌ |
| Offline command queuing | ❌ | ❌ | ✅ |

### Provider notes

**Fully Kiosk Browser** — local REST API on port 2323. Requires a password set in the app's Remote Administration settings.

**FreeKiosk** — local REST API on port 8080. API key is optional. Supports full MQTT bidirectional control (status updates + commands) and a D-pad remote control panel.

**Fully Cloud** — routes all calls through `api.fully-kiosk.com`. No local network access required; commands are queued with `persistent=1` so offline devices receive them on reconnect. Requires a Fully Cloud account and API key. Enter the account email as the "IP Address" and the API key as the password when adding a device.

---

## MQTT

Kiosk Admin supports three MQTT modes:

| Mode | How |
|---|---|
| **Embedded broker** | Toggle "Embedded Broker" in Settings → MQTT. Devices connect to `mqtt://{server-ip}:1883`. No external service needed. |
| **External broker** | Enter a broker URL in Settings → MQTT (e.g. `mqtt://192.168.1.10:1883` or `mqtts://...hivemq.cloud:8883`). |
| **No MQTT** | Leave Settings → MQTT empty. Device status is polled every 30 seconds. |

When a device has an **MQTT Device ID** configured, Kiosk Admin automatically discovers the ID by probing the device when it is first added.

---

## Adding a provider

1. Create `lib/providers/<name>.ts` extending `BaseKioskProvider`
2. Set `static readonly capabilities` flags
3. Implement `getDeviceInfo()`, `getScreenshot()`, `sendCommand()`, and stub unsupported methods with `ProviderCapabilityError`
4. Add the enum value to `prisma/schema.prisma` → `enum Provider`
5. Register it in `lib/providers/index.ts` and `lib/capabilities.ts`

See `specs/012-freekiosk-provider/` for a worked example.

---

## Project layout

```
fully-admin/
├── specs/          # Spec-Driven Development specs (requirements, design, tasks)
├── steering/       # Product, tech, and structure docs
└── kiosk-admin/    # Next.js application
    ├── app/        # Pages and API routes (App Router)
    ├── components/ # React components
    ├── lib/        # Business logic, providers, MQTT, auth, crypto, db
    └── prisma/     # Schema and migrations
```

---

## License

Kiosk Admin is released under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

You are free to use, modify, and self-host this software. If you distribute it or offer it as a network service, you must make your source code available under the same license.

**Commercial license available** — if you need to use Kiosk Admin in a proprietary product, white-label it, or distribute it without the AGPL obligations, contact us for a commercial license.

See [LICENSE](LICENSE) for the full license text.
