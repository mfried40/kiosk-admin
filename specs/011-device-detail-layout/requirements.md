# 011 — Device Detail Page Layout

## Problem Statement

The device detail page (`/devices/[id]`) is a single-column scroll with 12+ stacked sections.
Related content is interleaved with unrelated content (e.g. the History charts sit between
Advanced Controls and Screenshot), navigation to Device Settings and Usage CSV are orphaned
links at the very bottom, and there is no way to jump directly to a specific section without
scrolling past everything above it.

## User Stories

**US-011-1** — As an operator, I want a persistent page header that shows the device name,
IP/MAC, online badge, Edit, Delete and Refresh controls, so those actions are always
reachable regardless of which tab is active.

**US-011-2** — As an operator, I want an **Overview** tab that shows Live Status, Details
(group / tags / added date), and the 7-day History charts side-by-side on wide screens,
so I can assess device health at a glance without scrolling.

**US-011-3** — As an operator, I want a **Controls** tab that groups all direct device
interactions: Remote Controls, Screenshot, and Camera Snapshot, so I can operate the device
without the distraction of logs or metadata.

**US-011-4** — As an operator, I want an **Advanced** tab that groups all capability-gated
sections (Browser, App Launcher, Media Player, APK Manager, Maintenance, JS Injection,
File Transfer), the "View Device Settings" link and the "Download Usage CSV" link, so power
features are discoverable in one place.

**US-011-5** — As an operator, I want a **Logs** tab that contains both the Device Logs
panel (Fully Log / Logcat) and the Audit Log, so log data is separated from operational
controls.

**US-011-6** — As an operator, I want the active tab to be reflected in the URL as a
`?tab=overview|controls|advanced|logs` query parameter, so I can bookmark or share a
deep-link to a specific tab.

**US-011-7** — As an operator, I want the Overview tab to show a two-column grid on
screens ≥ 768 px wide (Live Status + Details on the left; History charts on the right),
and a single column on mobile, so the information density is appropriate for the viewport.

**US-011-8** — As an operator, I want tabs without any relevant content for the current
provider to still be visible but with a visual indicator that they are empty (muted text,
no badge), not hidden, so the layout remains predictable across providers.

**US-011-9** — As an operator, I want the Controls tab to lay out Screenshot and Camera
Snapshot side-by-side on wide screens, so screen space is used efficiently.

**US-011-10** — As an operator, I want each tab to load lazily (only mount its component
tree when first visited), so the initial page load does not perform unnecessary API calls
for inactive tabs.
