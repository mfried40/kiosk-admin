# 002 — Device Management: Tasks

- [x] Add `Device`, `Group`, `Tag`, `DeviceTag` models to `prisma/schema.prisma` + `schema.mongo.prisma`
- [x] Add `Provider` enum to both schemas; run migrate / db push
- [x] Implement `lib/crypto.ts` — `encrypt(plaintext)` / `decrypt(ciphertext)` with AES-256-GCM
- [x] Implement `GET /api/devices` — list with optional `groupId`, `tagId`, `search` filters
- [x] Implement `POST /api/devices` — Zod validation, encrypt password, create device
- [x] Implement `GET /api/devices/[id]` — return device without `passwordEnc`
- [x] Implement `PUT /api/devices/[id]` — handle password: re-encrypt if provided, skip if not
- [x] Implement `DELETE /api/devices/[id]` — cascade delete DeviceTag, DeviceStatusHistory, AuditLog
- [x] Implement `GET /api/devices/[id]/info` — proxy to provider `getDeviceInfo`, 5 s timeout, graceful offline
- [x] Implement Groups CRUD routes (`/api/groups`, `/api/groups/[id]`)
- [x] Implement Tags routes (`/api/tags`, `DELETE /api/tags/[id]`)
- [x] Implement `POST /api/devices/[id]/tags` — transactional tag sync
- [x] Build `DeviceCard` component — status badge, battery, tags, group
- [x] Build `DeviceForm` component — add/edit, password handling
- [x] Build dashboard page (`app/page.tsx`) — device grid, tag filter, group filter, polling fallback
- [x] Build device detail page (`app/devices/[id]/page.tsx`)
- [x] Build group management page (`app/groups/`)
- [x] Write Vitest tests for `lib/crypto.ts` (round-trip encrypt/decrypt, wrong key)
- [ ] Write Vitest tests for device CRUD routes (create, update without password, delete cascade)
- [ ] Write Playwright e2e: add device → appears on dashboard → shows offline on bad IP

**References:** US-002-1 through US-002-6
