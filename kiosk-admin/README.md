# Kiosk Admin

A self-hosted web dashboard for managing a fleet of Android kiosk devices. Monitor status, send remote commands, and configure devices — all from one place.

Supports **Fully Kiosk Browser** and **FreeKiosk** out of the box. Adding a new provider requires only a single new class.

---

## Features

- **Live device overview** — battery, screen state, current URL, online/offline history
- **Remote control** — screen on/off, URL navigation, restart, screensaver, TTS, volume, JS injection, and more
- **Device settings** — read and write all Fully Kiosk settings from the browser (categorised, searchable, auto-saved)
- **Multi-provider** — Fully Kiosk and FreeKiosk share the same UI; capability flags hide controls unsupported by a given provider
- **Bulk actions** — send a command to all selected devices at once
- **Groups & tags** — organise devices for filtering and bulk targeting
- **Config templates** — save and apply setting presets across devices of the same provider
- **Alert rules** — email notifications for offline, low battery, and unplugged events
- **Audit log** — every command is logged with user, device, and timestamp
- **MQTT + SSE** — live status updates when an MQTT broker is configured; 30-second polling fallback
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
| Testing | Vitest (88 tests), Playwright (e2e) |

---

## Getting started

### Prerequisites
- Node.js 20 LTS
- A `.env` file (copy `.env.example` and fill in the values — see below)

### Install & run

```bash
cd kiosk-admin
npm install
npx prisma migrate dev   # creates dev.db
npm run dev              # starts on http://localhost:3000
```

Visit `http://localhost:3000/setup` to create the first admin account.

### Environment variables

```
AUTH_SECRET=<random 32+ char string>       # required
AUTH_URL=http://localhost:3000             # required
ENCRYPTION_SECRET=<64 hex chars>           # required — device passwords encrypted at rest
DATABASE_URL=file:./dev.db                 # SQLite path (default)
DATABASE_PROVIDER=sqlite                   # sqlite | postgresql | mongodb
MQTT_BROKER_URL=                           # optional
SMTP_HOST=                                 # optional (alert emails)
```

> **ENCRYPTION_SECRET** must be exactly 64 hexadecimal characters (32 bytes). Generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

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
npx prisma db push                      # sync schema without migration (MongoDB)
npx prisma generate                     # regenerate client after schema changes
npx prisma studio                       # browse the database
```

---

## Supported providers

| Capability | Fully Kiosk | FreeKiosk |
|---|:---:|:---:|
| Screenshot | ✅ | ✅ |
| Screen on/off | ✅ | ✅ |
| URL navigation & reload | ✅ | ✅ |
| App restart | ✅ | ✅ |
| Screensaver control | ✅ | ✅ |
| Text-to-speech | ✅ | ✅ |
| Volume control | ✅ | ✅ |
| Camera capture | ✅ | ✅ |
| Audio / media playback | ✅ | ✅ |
| Maintenance (reboot, lock) | ✅ | ✅ |
| App launcher | ✅ | ✅ |
| JavaScript injection | ✅ | ✅ |
| Device settings API | ✅ | ❌ |
| File management | ✅ | ❌ |
| APK install / uninstall | ✅ | ❌ |
| Tab management | ✅ | ❌ |
| Log viewer | ✅ | ❌ |

FreeKiosk authentication uses an optional `X-Api-Key` header (leave the password field blank if your device has no API key configured).

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
    ├── lib/        # Business logic, providers, auth, crypto, db
    └── prisma/     # Schema and migrations
```

