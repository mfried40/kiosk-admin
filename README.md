# Kiosk Admin

A self-hosted web dashboard for managing a fleet of Android kiosk devices. Monitor status, send remote commands, and configure devices — all from one place.

Supports **Fully Kiosk Browser** and **FreeKiosk** out of the box.

---

## Repository layout

```
fully-admin/
├── kiosk-admin/     ← Next.js application (run all commands from here)
├── specs/           ← Spec-Driven Development specs, one folder per feature
├── steering/        ← Product, tech, and structure reference docs
├── AGENTS.md        ← Project constitution (coding rules and conventions)
└── PLAN.md          ← Master implementation plan
```

## Getting started

```bash
cd kiosk-admin
npm install
cp .env.example .env   # fill in NEXTAUTH_SECRET and ENCRYPTION_SECRET
npx prisma migrate dev
npm run dev            # http://localhost:3000
```

See [kiosk-admin/README.md](kiosk-admin/README.md) for full setup, environment variables, available commands, and provider capabilities.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Shadcn/ui, Tailwind CSS v4 |
| Auth | NextAuth v5 (JWT, bcrypt) |
| Database | Prisma v7 — SQLite / PostgreSQL / MongoDB |
| Testing | Vitest, Playwright |

## Spec-Driven Development

Features are specced before they are coded. Each `specs/NNN-feature-name/` folder contains:

- `requirements.md` — EARS-style user stories
- `design.md` — interfaces, data flow, and component sketch
- `tasks.md` — concrete implementation checklist (check off as you go)

The spec is the source of truth. If code and spec disagree, fix the code.
