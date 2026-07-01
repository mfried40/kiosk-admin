# 004 — Remote Control: Tasks

- [x] Implement `POST /api/devices/[id]/command` — auth guard, capability assert, param validation, provider call, audit log
- [x] Implement `POST /api/devices/bulk/command` — provider homogeneity check, `Promise.allSettled`, audit log per device
- [x] Add volume range Zod schema; plug into command route
- [x] Build `DeviceControls` component — all sections, capability gating, loading state, toasts
- [x] Add device selection state to dashboard; build bulk action bar
- [x] Write Vitest tests for `POST /api/devices/[id]/command` (success, capability error → 501, provider error → 502, viewer → 403)
- [x] Write Vitest tests for `POST /api/devices/bulk/command` (mixed providers → 400, partial failure response)
- [ ] Write Playwright e2e: open device detail → click "Screen Off" → success toast appears

**References:** US-004-1, US-004-2, US-004-3, US-004-4
