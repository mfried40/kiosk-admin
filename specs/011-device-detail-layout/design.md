# 011 — Device Detail Page Layout: Design

## Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    CLOCK-1   192.168.1.100  ● Online   ↺  ✎ Edit  🗑   │  ← Persistent header (always visible)
├─────────────────────────────────────────────────────────────────┤
│  [ Overview ]  [ Controls ]  [ Advanced ]  [ Logs ]            │  ← Tab bar
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tab content (scrollable)                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tab: Overview

**Desktop (≥ md)** — two-column grid, `grid-cols-[1fr_1.5fr]`:

```
┌─────────────────────┬──────────────────────────────┐
│  Live Status card   │  History (last 7 days) card  │
│  (with refresh btn) │  (battery + online charts)   │
├─────────────────────┤                              │
│  Details card       │                              │
│  (group, tags, date)│                              │
└─────────────────────┴──────────────────────────────┘
```

**Mobile** — single column: Live Status → Details → History.

Content:
- **Live Status card** — same content as today (model, Android, app version, battery,
  screen, storage, current URL); `Badge` shows Online/Offline; inline Refresh button
  (`RefreshCw`) calls `GET /api/devices/[id]/info` directly.
- **Details card** — group, tags, added date (same as today). No change.
- **History card** — `StatusHistoryCharts` (same as today).

---

## Tab: Controls

```
┌─────────────────────────────────────────────────────────────────┐
│  Remote Controls card (DeviceControls — full width)             │
├───────────────────────────────┬─────────────────────────────────┤
│  Screenshot card              │  Camera Snapshot card           │
│  (if caps.hasScreenshot)      │  (if caps.hasCamshot)           │
└───────────────────────────────┴─────────────────────────────────┘
```

- Screenshot and Camera Snapshot are placed in a `grid-cols-2 gap-4` grid on `md+`;
  single column on mobile.
- If only one of the two is supported, that single card takes full width.
- If neither is supported, the grid row is not rendered.

---

## Tab: Advanced

Quick-action row at the top, then a **nested sub-tab bar** for the capability-gated panels:

```
┌─────────────────────────────────────────────────────────────────┐
│  [ ⚙ View Device Settings → ]  [ ↓ Download Usage CSV ]        │  ← Quick-action row
├─────────────────────────────────────────────────────────────────┤
│  [ Browser ] [ App Launcher ] [ Media ] [ APK ] [ Maintenance ] │
│  [ JS Injection ] [ File Transfer ]                             │  ← Sub-tab bar (wraps)
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Active sub-tab content                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Sub-tabs use the same button-tab pattern as the top-level tabs (same CSS classes).
- Only sub-tabs whose capability flag is true are rendered; the first visible sub-tab is
  active by default.
- Sub-tab state is local (`useState`) — it is **not** reflected in the URL.
- Sub-tab content is mounted lazily using the same `visited` Set pattern as the top-level
  tabs (scoped to the Advanced tab's own `advancedVisited` state).
- "View Device Settings" button: `buttonVariants({ variant: "outline", size: "sm" })`,
  links to `/devices/[id]/settings`. Conditional on `caps.hasAppManagement`.
- "Download Usage CSV" anchor: same style. Conditional on `caps.hasUsageStats`.
- Both rendered as a `flex gap-3 flex-wrap` row above the sub-tab bar.
- If no advanced capability is supported **and** neither link is shown, the Advanced tab
  renders a muted "No advanced capabilities available for this provider." message with no
  sub-tab bar.

---

## Tab: Logs

```
┌─────────────────────────────────────────────────────────────────┐
│  Device Logs card (LogsPanel — Fully Log + Logcat sub-tabs)     │
│  (if caps.hasLogViewer)                                         │
├─────────────────────────────────────────────────────────────────┤
│  Audit Log card (AuditPanel)                                    │
└─────────────────────────────────────────────────────────────────┘
```

- If `caps.hasLogViewer` is false, the LogsPanel card is omitted; AuditPanel always shown.

---

## URL / State

- Active tab is stored in `?tab=overview|controls|advanced|logs` query param.
- On page load with no param, default to `overview`.
- Tab switching uses `router.replace` (no history entry) — navigating back takes the user
  off the device page, not to the previous tab.
- The URL param is read via `useSearchParams()`.

---

## Lazy Loading

Each tab's component tree is only mounted on first visit.
Implementation pattern:

```tsx
const [visited, setVisited] = useState<Set<string>>(new Set(["overview"]));

function handleTabChange(tab: string) {
  setVisited((prev) => new Set([...prev, tab]));
  router.replace(`?tab=${tab}`, { scroll: false });
}

// In JSX:
{visited.has("controls") && (
  <div className={activeTab === "controls" ? "block" : "hidden"}>
    {/* Controls tab content */}
  </div>
)}
```

Using `hidden` (CSS display:none) instead of conditional unmounting keeps scroll positions
and loaded screenshots in memory after first visit.

---

## Persistent Header

The header row already exists. Changes:
- Move the inline `<Button onClick={fetchInfo}>` refresh next to the Online badge
  (or as an icon-only button at the right end of the header bar, before Edit).
- The refresh button calls `fetchInfo` + `fetchDevice` together (same as today's mount
  effect).

---

## Files Changed

| File | Change |
|------|--------|
| `app/(app)/devices/[id]/page.tsx` | Full restructure — tab state, lazy visited set, grid layouts, header changes |
| No new components needed | All existing components reused as-is |

---

## Non-Goals

- No per-tab URL with separate routes (`/devices/[id]/overview`, etc.) — query param only.
- No animation between tabs.
- No tab badge counts (e.g. "3 logs") — too dynamic.
