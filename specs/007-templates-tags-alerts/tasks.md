# 007 — Config Templates, Tags & Alerting: Tasks

## Config Templates
- [x] Add `ConfigTemplate` model to both Prisma schemas; run migrate / db push
- [x] Implement Templates CRUD routes (`/api/templates`, `/api/templates/[id]`)
- [x] Implement `POST /api/templates/[id]/apply` — provider validation, `Promise.allSettled`, audit log
- [x] Implement `lib/templates.ts` — `applyTemplate()` helper
- [x] Build `/templates` page — template list, create form, apply panel with device multi-select

## Tags
- [x] Build tag filter UI on dashboard — multi-select, URL query param sync
- [ ] Build "Send command to tag" action — resolves devices, validates provider homogeneity

## Alerting
- [x] Add `AlertRule`, `Notification` models to both Prisma schemas; run migrate / db push
- [x] Implement `lib/alerts.ts` — `evaluateAlerts()` with hysteresis for battery
- [x] Implement Alert CRUD routes (`/api/alerts`, `/api/alerts/[id]`)
- [x] Wire `evaluateAlerts()` into MQTT handlers (`handleEvent`) and polling path
- [x] Implement email dispatch in `lib/alerts.ts` using nodemailer (SMTP from app config)
- [x] Build alert rules section on `/settings` page
- [x] Build notification bell in nav — badge, dropdown, mark-as-read
- [x] Write Vitest tests for `lib/alerts.ts` (offline alert fires, battery hysteresis, email sent when SMTP configured)
- [x] Write Vitest tests for template apply (provider mismatch → 400, partial failure response)

**References:** US-007-1 through US-007-7
