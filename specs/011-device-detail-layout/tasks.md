# 011 — Device Detail Page Layout: Tasks

## Page restructure

- [x] Add `useSearchParams` import; read `?tab` param; default to `"overview"`
- [x] Add `visited` state (`Set<string>`, initialised with `"overview"`) for lazy mounting
- [x] Add `handleTabChange(tab)` helper: updates `visited` set + calls `router.replace(?tab=…, { scroll: false })`
- [x] Add tab bar UI: four buttons (Overview / Controls / Advanced / Logs), active state via `bg-primary text-primary-foreground`
- [x] Wrap Overview content in lazy-mount + `hidden`/`block` toggle
- [x] Restructure Overview layout: `grid-cols-1 md:grid-cols-[1fr_1.5fr]` — left column (Live Status + Details), right column (History)
- [x] Move inline Refresh button to the persistent header row (icon-only, before Edit button)
- [x] Wrap Controls content in lazy-mount + toggle
- [x] Controls layout: Remote Controls full width; Screenshot + Camera Snapshot in `grid-cols-1 md:grid-cols-2 gap-4`
- [x] Wrap Advanced content in lazy-mount + toggle
- [x] Advanced layout: quick-action row (View Device Settings + Download Usage CSV) at top; nested sub-tab bar below (only showing capability-supported tabs); lazy-mount sub-tab content via `advancedVisited` Set; empty-state message if nothing is visible
- [x] Move "View Device Settings" link and "Download Usage CSV" anchor into the Advanced tab quick-action row (remove from page bottom)
- [x] Wrap Logs content in lazy-mount + toggle
- [x] Logs layout: LogsPanel (conditional on `caps.hasLogViewer`) then AuditPanel

## Verification

- [x] `npx tsc --noEmit` — no errors
- [x] `npm run build` — clean build, `/devices/[id]` still listed as a dynamic route
- [x] `npm test` — all existing tests still pass
- [ ] Manual check: tab param appears in URL on switch; refreshing page restores active tab; Overview loads on initial visit with no param; visiting Controls/Advanced/Logs mounts those trees once; revisiting does not re-fetch

**References:** US-011-1 through US-011-10
