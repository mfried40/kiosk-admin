# 001 — Auth & Onboarding: Tasks

- [x] Add `User` and `Role` models to `prisma/schema.prisma` and `prisma/schema.mongo.prisma`
- [x] Run initial migration / db push; verify schema
- [x] Implement `lib/auth.ts` — NextAuth config, credentials provider, JWT + session callbacks
- [x] Implement `middleware.ts` — protect all routes except `/login`, `/setup`, `/api/auth/**`
- [x] Implement `POST /api/auth/setup` route — Zod validation, user-count guard, bcrypt hash, insert
- [x] Build `app/setup/page.tsx` — server-side user count check, redirect to 404 if > 0
- [x] Build `app/setup/SetupForm.tsx` — client form, calls setup API, redirects to `/login`
- [x] Build `app/(auth)/login/page.tsx` — NextAuth signIn form
- [x] Add role guard helper `lib/api-guard.ts` — `requireRole(req, role)` throws 401/403
- [ ] Write Vitest tests for `lib/auth.ts` authorize callback (valid creds, wrong password, unknown email)
- [x] Write Vitest tests for `POST /api/auth/setup` (happy path, duplicate user, short password)
- [ ] Write Playwright e2e: first-run redirect → setup → login → dashboard

**References:** US-001-1, US-001-2, US-001-3, US-001-4
