# 010 — Device Settings View: Tasks

## Schema

- [x] Create `lib/settings-schema-web.ts` — Web Content and Browsing categories (startUrl, urlWhitelist, urlBlacklist, autoReload*, zoom, userAgent, injectJavascript, etc.)
- [x] Create `lib/settings-schema-kiosk.ts` — Kiosk Mode and Security categories (kioskMode, PIN, whitelist/blacklist, disableStatusBar, disableButtons, JS interface, SSL, web filter, etc.)
- [x] Create `lib/settings-schema-device.ts` — Screen & Display, Audio & Media, Motion Detection, Screensaver, Remote & MQTT, App Management, Other categories
- [x] Create `lib/settings-schema.ts` — re-exports and merges all three files; exports `SETTINGS_SCHEMA: SettingDef[]` and `getSettingDef(key): SettingDef | undefined`

## Components

- [x] Build `SettingControl.tsx` — renders the correct input control for each `SettingType`:
  - `boolean` → toggle (HTML checkbox styled as switch), saves on change
  - `number` → `<Input type="number">` with min/max from schema
  - `select` → `<select>` with `options` from schema
  - `color` → color swatch button + hex text input
  - `url` → `<Input type="url">` validated before save
  - `multiline` → `<Textarea>` resizable
  - `password` → `<Input type="password">` + show/hide toggle
  - `string` → `<Input type="text">`
  - Unknown keys → `<Input type="text">` (raw key displayed)
  - Shows inline "Saved ✓" (fades after 2s) on success; shows error text on failure
- [x] Build `SettingsTable.tsx` — tabbed + searchable table:
  - Tab list: All, Web Content, Browsing, Kiosk Mode, Screen & Display, Audio & Media, Motion Detection, Screensaver, Remote & MQTT, App Management, Security, Other
  - Active tab filters rows to matching `category`
  - Typing in search bar bypasses tabs and shows flat filtered list (by key + label)
  - Hides tabs that have zero returned settings from device
  - Renders `SettingControl` for each row
- [x] Build `SettingsImportPanel.tsx` — collapsible "Import from URL":
  - URL input, Import button (disabled until valid URL)
  - POSTs `{ cmd: "importSettingsFile", params: { url } }` to `/api/devices/[id]/command`
  - On success: triggers settings refresh

## Page

- [x] Create `app/(app)/devices/[id]/settings/page.tsx` — Client Component:
  - On mount: fetch device name + `GET /api/devices/[id]/device-settings`
  - Show skeleton while loading; show offline banner on 503; 404 redirect if !hasAppManagement
  - Heading: "[device name] — Settings", back link to `/devices/[id]`
  - Refresh button: re-fetches settings from device
  - Renders `SettingsTable` + `SettingsImportPanel`

## Device detail page cleanup

- [x] Remove `DeviceSettingsPanel` import and usage from `app/(app)/devices/[id]/page.tsx`
- [x] Add "View Settings →" link button to the device detail page (conditional on `caps.hasAppManagement`)

## Testing

- [ ] Write Vitest tests for `getSettingDef()` — known key returns correct def, unknown key returns undefined
- [ ] Write Vitest snapshot/unit tests for SettingControl rendering (boolean renders toggle, select renders options, etc.) — optional, lower priority

**References:** US-010-1 through US-010-7
