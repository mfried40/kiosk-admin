# 010 — Device Settings View: Requirements

## Context
The current `DeviceSettingsPanel` is a collapsible table that lives at the bottom of the device detail page.
It shows all 300+ settings as a flat searchable list with no labels, categories, or type-aware inputs.

This spec replaces it with:
1. A dedicated route `/devices/[id]/settings` — the settings get their own full page.
2. Tabbed categories that match the Fully Kiosk configuration sections.
3. A settings schema that maps each key to a human-readable label, description, and the correct input type.

---

## User Stories

### US-010-1: Dedicated settings page
As an admin, I want a dedicated settings page for each device so that the device detail page stays focused on status and controls.

**Acceptance criteria**
- WHEN the admin navigates to `/devices/[id]/settings`, the system SHALL show the full settings editor.
- The device detail page SHALL replace the `DeviceSettingsPanel` collapsible with a **"View Settings →"** link that navigates to `/devices/[id]/settings`.
- The settings page SHALL show the device name as the page heading and a back link to the device detail page.
- WHEN the device provider does not have `hasAppManagement`, the settings page SHALL return `404`.

### US-010-2: Tabbed categories
As an admin, I want settings grouped into logical tabs so that I can quickly find the setting I need without scrolling through all 300+ entries.

**Acceptance criteria**
- WHEN the settings page loads, the system SHALL display the following tabs:
  `Web Content`, `Browsing`, `Kiosk Mode`, `Screen & Display`, `Audio & Media`, `Motion Detection`, `Screensaver`, `Remote & MQTT`, `App Management`, `Security`, `Other`.
- Each tab SHALL only display settings that belong to that category per the settings schema.
- An `All` tab SHALL show all settings regardless of category with the search input.
- WHEN a tab contains no settings returned from the device, it SHALL be hidden rather than shown empty.
- The tab bar SHALL be scrollable on small screens.

### US-010-3: Labelled settings with descriptions
As an admin, I want each setting shown with a human-readable label and a short description so that I can understand what it does without referring to external documentation.

**Acceptance criteria**
- WHEN a setting key is known in the schema, the system SHALL display the label instead of the raw key.
- WHEN a setting key has a description in the schema, the system SHALL display it as secondary text below the label.
- WHEN a setting key is NOT in the schema (unknown / custom), the system SHALL display the raw key with no description and render it as a plain text input.
- The label and description text SHALL match the Fully Kiosk documentation.

### US-010-4: Type-aware input controls
As an admin, I want input controls that match the type of each setting so that I can change values without guessing the expected format.

**Acceptance criteria**
- `boolean` settings SHALL render as a toggle switch (on/off), saving immediately on toggle.
- `number` settings SHALL render as a number input with optional min/max constraints.
- `select` settings SHALL render as a drop-down with predefined options.
- `color` settings SHALL render as a color swatch + hex text input.
- `url` settings SHALL render as a URL input validated on save.
- `multiline` settings SHALL render as a resizable textarea (for whitelist/blacklist fields).
- `password` settings SHALL render as a masked text input with a show/hide toggle.
- All other settings SHALL render as a single-line text input.
- WHEN the admin changes any value, the system SHALL call `PUT /api/devices/[id]/device-settings`.
- `boolean` settings save on toggle; all other types save on blur or on pressing Enter / a "Save" button.
- WHEN a save succeeds, the system SHALL show an inline "Saved ✓" confirmation that disappears after 2 seconds.
- WHEN a save fails, the system SHALL show the error message inline.

### US-010-5: Search across all settings
As an admin, I want to search across all setting keys and labels so that I can find a setting without browsing tabs.

**Acceptance criteria**
- A persistent search input SHALL appear at the top of the settings page.
- WHEN the admin types in the search field, the system SHALL filter settings client-side across all categories by key AND label (case-insensitive).
- Matching settings SHALL be shown in a flat list below the tab bar, bypassing the tab structure.
- WHEN the search field is cleared, the system SHALL restore the normal tab view.

### US-010-6: Load and refresh
As an admin, I want the settings to load automatically when I open the page and be refreshable so that I always see the current device state.

**Acceptance criteria**
- WHEN the page mounts, the system SHALL automatically call `GET /api/devices/[id]/device-settings`.
- WHILE loading, a skeleton loader SHALL be shown in place of the settings.
- A "Refresh" button SHALL reload all settings from the device.
- WHEN the device is offline (`503`), the system SHALL show an alert banner: "Device is offline — cannot load settings."

### US-010-7: Import settings from URL
As an admin, I want to import a JSON settings file from a URL so that I can apply a configuration template to the device remotely.

**Acceptance criteria**
- A collapsible "Import from URL" panel SHALL appear below the settings table.
- WHEN the admin enters a URL and clicks "Import", the system SHALL POST `{ cmd: "importSettingsFile", params: { url } }` to `/api/devices/[id]/command`.
- On success, the system SHALL refresh the settings display.
- The URL SHALL be validated as a proper URL before enabling the Import button.

---

## Non-functional Requirements
- The settings page SHALL handle 300+ settings without performance degradation.
- Category tabs SHALL filter settings client-side (no additional API calls per tab switch).
- The settings schema file SHALL be kept under 300 lines; split by category if necessary.

## Out of Scope
- Exporting settings to a JSON file (currently available via Remote Admin directly).
- Editing KNOX or Device Owner settings (provisioned-device-only fields) — deferred.
- Live watch/auto-refresh on setting changes from the device.
