# 006 — Monitoring & Status History: Tasks

- [x] Add `DeviceStatusHistory` model to both Prisma schemas with compound index; run migrate / db push
- [x] Implement `lib/history.ts` — `recordStatus()` with transactional insert + prune
- [x] Implement `GET /api/devices/[id]/screenshot` — capability assert, proxy PNG buffer
- [x] Implement `GET /api/devices/[id]/history` — `from`/`to` query params, ordered response
- [x] Implement `GET /api/devices/[id]/logs` — capability assert, proxy log text
- [x] Implement `GET /api/devices/[id]/usage-stats` — capability assert, proxy CSV as file download
- [x] Wire `recordStatus()` call into `GET /api/devices/[id]/info` response path
- [x] Build `ScreenshotPanel` component — image, refresh button, skeleton, error states
- [x] Build `StatusHistoryCharts` component — battery line chart + uptime bar chart
- [x] Build `LogPanel` component — lazy accordion, monospace pre, copy button
- [x] Add "Download Usage CSV" button to device detail page (capability-gated)
- [x] Write Vitest tests for `lib/history.ts` (insert + prune on boundary, no prune before window)
- [ ] Write Vitest tests for history API (`from`/`to` filtering)
- [ ] Write Playwright e2e: device detail page → screenshot loads → history charts render

**References:** US-006-1, US-006-2, US-006-3, US-006-4, US-006-5
