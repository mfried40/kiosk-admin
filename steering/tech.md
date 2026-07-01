# Tech Stack

## Versions (pinned)
| Package | Version |
|---|---|
| Next.js | 16.2.9 |
| React | 19.2.4 |
| Prisma / @prisma/client | 7.8.0 |
| next-auth | 5.0.0-beta.31 |
| better-sqlite3 | 12.11.1 |
| @prisma/adapter-better-sqlite3 | 7.8.0 |
| Tailwind CSS | v4 |
| bcryptjs | 3.0.3 |
| zod | 4.4.3 |

## Frontend
- **Next.js 16** (App Router, Turbopack) — all code in `kiosk-admin/` subdirectory
- **Shadcn/ui v4** + **Tailwind CSS v4** — components in `components/ui/`, `@theme inline` in globals.css
- **React 19** — Server Components where possible; Client Components for interactivity

## Auth — NextAuth v5 (beta)
Config is **split** for Next.js 16 edge-compatibility:
- `lib/auth.config.ts` — edge-safe config (no Node.js native deps). Used by `proxy.ts`.
- `lib/auth.ts` — full config with bcrypt + db. Used by API route and server components.
- Route: `app/api/auth/[...nextauth]/route.ts` exports `{ GET, POST }` from `handlers`.
- `proxy.ts` (NOT `middleware.ts` — renamed in Next.js 16) handles session protection.
- Strategy: JWT. Token carries `id` and `role`. Session callbacks propagate both.

## Database — Prisma v7 (breaking changes vs v6)
**Critical:** Prisma v7 removed `url` from `schema.prisma` datasource. URL is now in `prisma.config.ts`.
- `prisma/schema.prisma` — datasource has only `provider = "sqlite"`, no `url`.
- `prisma.config.ts` — exports default config with `datasource.url`. This file is read by the Prisma CLI only.
- Runtime DB access uses `@prisma/adapter-better-sqlite3` adapter (NOT the default Wasm driver).
- Generated client lives at `lib/generated/prisma/client` (not the default `node_modules/.prisma/client`).
- Import: `import { PrismaClient } from "./generated/prisma/client"`.

| Provider | When used | Migration command |
|---|---|---|
| SQLite | Default, dev/small deployments | `prisma migrate dev` |
| PostgreSQL | Production, multi-instance | `prisma migrate dev` |
| MongoDB | When Atlas is preferred | `prisma db push` |

Switched via `DATABASE_PROVIDER` env var.

## Crypto
- `lib/crypto.ts` — AES-256-GCM via Node.js `crypto` module.
- Key comes from `ENCRYPTION_SECRET` env var — **must be exactly 64 hex characters (32 bytes)**.
- Output format: `iv:authTag:ciphertext` (all hex strings, colon-separated).

## Testing (planned, not yet wired up)
- **Vitest** — unit + integration
- **@testing-library/react** — React component tests
- **Playwright** — end-to-end browser tests
- **msw** — mock service worker for stubbing device HTTP calls in tests

## Real-time (planned)
- **MQTT broker** (external, optional) — devices publish status to topics
- **Server-Sent Events** (`GET /api/events`) — server pushes to browser
- **HTTP polling** — 30s interval fallback when MQTT not configured

## Key environment variables
```
AUTH_SECRET              # required (NextAuth v5 uses AUTH_SECRET)
AUTH_URL                 # required (e.g. http://localhost:3000)
ENCRYPTION_SECRET        # required — exactly 64 hex chars (32 bytes)
DATABASE_URL             # SQLite file path, default: file:./dev.db
DATABASE_PROVIDER        # sqlite | postgresql | mongodb (default: sqlite)
MQTT_BROKER_URL          # optional
SMTP_HOST                # optional
```

## Known gotchas
- **Turbopack React Client Manifest bug**: Do NOT import a `"use client"` component from a Server Component inside `<Suspense>`. Instead, add `"use client"` directly to `page.tsx` and co-locate the form logic there.
- **proxy.ts not middleware.ts**: Next.js 16 renamed the edge middleware entrypoint. Keep it as `proxy.ts`.
- **Turbopack workspace root**: Set `turbopack: { root: process.cwd() }` in `next.config.ts` if the project lives in a subdirectory.
- **ENCRYPTION_SECRET**: Must be 64 hex chars. The `.env` placeholder zeros must be replaced before using device password encryption.
