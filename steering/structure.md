# Project Structure

The Next.js app lives in the **`kiosk-admin/`** subdirectory. All `cd`, `npx`, and `prisma` commands must be run from there.

```
fully-admin/              ← workspace root
├── AGENTS.md             ← Constitution (immutable project rules)
├── PLAN.md               ← Master implementation plan
├── specs/                ← SDD specs — one folder per feature
│   ├── 001-auth-onboarding/
│   ├── 002-device-management/
│   ├── 003-provider-abstraction/
│   ├── 004-remote-control/
│   ├── 005-realtime-mqtt/
│   ├── 006-monitoring-history/
│   ├── 007-templates-tags-alerts/
│   ├── 008-audit-log/
│   ├── 009-advanced-device-controls/  ← API ✅ done; UI ✅ done
│   ├── 010-device-settings-view/      ← dedicated settings page, categorised tabs, type-aware inputs; COMPLETE
│   └── 011-device-detail-layout/      ← tab-based page reorganisation (Overview/Controls/Advanced/Logs); not yet implemented
├── steering/             ← Memory bank (this folder)
│   ├── product.md
│   ├── tech.md
│   └── structure.md
│
└── kiosk-admin/          ← Next.js application root
    ├── app/
    │   ├── login/page.tsx          ✅ login page
    │   ├── setup/page.tsx          ✅ first-run setup
    │   ├── (app)/
    │   │   ├── layout.tsx          ✅ auth guard + AppNav sidebar
    │   │   ├── page.tsx            ✅ dashboard — device grid, filters, bulk actions, 30s polling
    │   │   ├── devices/[id]/
    │   │   │   └── page.tsx        ✅ device detail — live status, edit, delete, remote controls
    │   │   ├── groups/page.tsx     ✅ groups CRUD
    │   │   └── tags/page.tsx       ✅ tags CRUD
    │   │
    │   │   ── PLANNED ──
    │   ├── settings/page.tsx       ✗ app config (MQTT, SMTP, retention)
    │   ├── templates/page.tsx      ✗ config template library
    │   ├── audit/page.tsx          ✗ audit log viewer
    │   └── api/
    │       ├── auth/
    │       │   ├── [...nextauth]/route.ts  ✅ NextAuth handler
    │       │   └── setup/route.ts          ✅ GET {configured} / POST create admin
    │       ├── devices/
    │       │   ├── route.ts                ✅ GET (list+filters) / POST (create)
    │       │   ├── bulk/command/route.ts   ✅ POST bulk command
    │       │   └── [id]/
    │       │       ├── route.ts            ✅ GET / PUT / DELETE
    │       │       ├── info/route.ts       ✅ GET live device info
    │       │       ├── command/route.ts    ✅ POST single command
    │       │       └── tags/route.ts       ✅ POST tag sync
    │       ├── groups/
    │       │   ├── route.ts                ✅ GET / POST
    │       │   └── [id]/route.ts           ✅ GET / PUT / DELETE
    │       ├── tags/
    │       │   ├── route.ts                ✅ GET / POST
    │       │   └── [id]/route.ts           ✅ DELETE
    │       │
    │       │   ── PLANNED ──
    │       ├── templates/          ✗ CRUD + apply
    │       ├── alerts/             ✗ CRUD
    │       ├── audit/              ✗ query
    │       ├── events/             ✗ SSE stream
    │       └── config/             ✗ app settings
    │
    ├── components/
    │   ├── ui/                     ✅ Shadcn components (button, badge, card, dialog, input, label, select)
    │   ├── AppNav.tsx              ✅ sidebar navigation
    │   ├── DeviceCard.tsx          ✅ card with status, battery, tags, bulk checkbox
    │   ├── DeviceForm.tsx          ✅ add/edit form — inline group/tag creation
    │   ├── DeviceControls.tsx      ✅ all remote control sections, capability-gated
    │   └── ConfirmDialog.tsx       ✅ reusable delete confirmation dialog
    │
    ├── lib/
    │   ├── auth.config.ts          ✅ edge-safe auth config (for proxy.ts)
    │   ├── auth.ts                 ✅ full NextAuth config (bcrypt + db)
    │   ├── crypto.ts               ✅ AES-256-GCM encrypt/decrypt
    │   ├── db.ts                   ✅ Prisma client singleton (better-sqlite3 adapter)
    │   ├── utils.ts                ✅ cn() helper (Shadcn)
    │   ├── types.ts                ✅ DeviceSafe, DeviceWithRelations, DeviceInfo, ApiError
    │   ├── api-guard.ts            ✅ requireAuth / requireRole / guardErrorResponse
    │   ├── audit.ts                ✅ writeAuditLog() — wired into command routes
    │   ├── capabilities.ts         ✅ client-safe getCapabilitiesForProvider() (no Prisma)
    │   ├── provider.types.ts       ✅ KioskProvider interface, BaseKioskProvider, ProviderCapabilities
    │   ├── providers/
    │   │   ├── index.ts            ✅ getProvider() / getCapabilities() / assertCapability()
    │   │   ├── fully-kiosk.ts      ✅ Fully Kiosk REST — all capabilities, 5s timeout
    │   │   └── free-kiosk.ts       ✅ Free Kiosk stub — all methods throw ProviderCapabilityError
    │   ├── generated/prisma/       ✅ generated Prisma client (do not edit)
    │   │
    │   │   ── PLANNED ──
    │   ├── mqtt/
    │   │   ├── client.ts           ✗ singleton mqtt.js client
    │   │   ├── handlers.ts         ✗ topic → DB + SSE
    │   │   └── sse.ts              ✗ SSE broadcaster
    │   ├── alerts.ts               ✗ alert rule evaluation + email dispatch
    │   └── history.ts              ✗ recordStatus() with prune
    │   ├── schema.prisma           ✅ full schema (all models, SQLite/PG)
    │   └── migrations/             ✅ 20260630204009_init applied
    │
    ├── proxy.ts                    ✅ session protection (Next.js 16 proxy, not middleware)
    ├── prisma.config.ts            ✅ Prisma v7 datasource URL config
    ├── next.config.ts              ✅ turbopack.root = process.cwd()
    ├── .env                        ✅ DATABASE_URL, AUTH_SECRET, ENCRYPTION_SECRET
    ├── .env.example                ✅ documented template
    └── dev.db                      ✅ SQLite database (fresh, empty)
```

## Naming conventions
- React components: `PascalCase.tsx`
- Lib modules: `kebab-case.ts`
- API route files: Next.js convention (`route.ts` in folder matching URL segment)
- Prisma model fields: `camelCase`
- Env vars: `SCREAMING_SNAKE_CASE`

## Import rules
- Alias `@/` maps to the project root (configured in `tsconfig.json`)
- Never import from `app/` inside `lib/` — dependency goes one way only
- Types shared between `app/` and `lib/` live in `lib/types.ts`

## Implementation status (as of 2026-06-30)

### ✅ Done
- **spec 001 (auth-onboarding)**: Login, setup, `/api/auth/setup`, NextAuth v5 credentials + JWT, `proxy.ts` session guard, `lib/api-guard.ts`, `lib/crypto.ts`, Prisma schema + migration. *(tests pending)*
- **spec 002 (device-management)**: Full device CRUD APIs, groups CRUD APIs, tags API, tag-sync endpoint, `DeviceCard`, `DeviceForm` (with inline group/tag creation), dashboard with search/filter/polling/bulk-select, device detail page, groups page, tags page. *(tests pending)*
- **spec 003 (provider-abstraction)**: `lib/provider.types.ts`, `lib/providers/fully-kiosk.ts`, `lib/providers/free-kiosk.ts`, `lib/providers/index.ts` with `getProvider` / `assertCapability`, `lib/capabilities.ts` (client-safe). Device API + UI wired up. *(tests pending)*
- **spec 004 (remote-control)**: `POST /api/devices/[id]/command`, `POST /api/devices/bulk/command`, `DeviceControls` component, bulk action bar on dashboard. *(tests pending)*
- **spec 008 (audit-log)** — partial: `lib/audit.ts` implemented; `writeAuditLog` wired into single + bulk command routes. API endpoint, UI page, and remaining wire-ups not yet done.

### 🔜 Next up: spec 005 — real-time MQTT
- `lib/mqtt/` — client singleton, SSE broadcaster, topic handlers
- `GET /api/events` — SSE stream
- `GET/PUT /api/config` — MQTT + SMTP settings
- `app/settings/page.tsx`
- Dashboard EventSource + polling fallback

### ❌ Not started
- spec 006: monitoring / status history
- spec 007: config templates, tag commands, alerting
- spec 008: audit log viewer + remaining wire-ups
- spec 005: MQTT + SSE
- spec 006: monitoring / history
- spec 007: templates, tags, alerts
- spec 008: audit log

### Known outstanding issue
- `ENCRYPTION_SECRET` in `.env` is 32 placeholder zeros — must be replaced with **64 hex chars** (32 bytes) before device password encrypt/decrypt will work. The value in `.env.example` documents the correct format.
