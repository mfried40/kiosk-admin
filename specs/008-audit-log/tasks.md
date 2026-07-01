# 008 — Audit Log: Tasks

- [x] Add `AuditLog` model to both Prisma schemas with indexes; run migrate / db push
- [x] Implement `lib/audit.ts` — `writeAuditLog()` helper with typed `AuditPayload`
- [x] Implement `GET /api/audit` — ADMIN guard, filter params, pagination, join user+device names
- [x] Wire `writeAuditLog()` into `POST /api/devices/[id]/command`
- [x] Wire `writeAuditLog()` into `PUT /api/devices/[id]`
- [ ] Wire `writeAuditLog()` into settings change route (fetch current value → log old+new)
- [x] Wire `writeAuditLog()` into `POST /api/templates/[id]/apply` (per device)
- [x] Build `/audit` page — filter bar, paginated table, ADMIN-only guard
- [x] Build `AuditPanel` component for device detail — last 20 entries, "View all" link
- [x] Write Vitest tests for `lib/audit.ts` (writes correct fields, device null for global actions)
- [x] Write Vitest tests for `GET /api/audit` (filter by deviceId, pagination, viewer → 403)

**References:** US-008-1, US-008-2, US-008-3, US-008-4
