# 007 — Config Templates, Tags & Alerting: Requirements

## Config Templates

### US-007-1: Save a settings snapshot as a template
As an admin, I want to save a device's current settings as a named template, so that I can reapply them to other devices later.

**Acceptance criteria**
- WHEN an admin saves a template, the system SHALL persist `{ name, provider, settings: Record<string, string> }` in the `ConfigTemplate` table.
- IF a template name already exists for the same provider, the system SHALL return `409 Conflict`.
- Templates are provider-scoped: a template created for `FULLY_KIOSK` can only be applied to `FULLY_KIOSK` devices.

### US-007-2: Apply a template to one or many devices
As an admin, I want to apply a saved template to multiple devices at once, so that I can standardise settings across a fleet.

**Acceptance criteria**
- WHEN an admin applies a template, the system SHALL POST `{ deviceIds: string[] }` to `POST /api/templates/[id]/apply`.
- The system SHALL verify all target devices match the template's provider — any mismatch causes a `400` and no settings are changed.
- The system SHALL call `provider.setSetting` for each setting key in the template, for each target device.
- WHEN all settings are applied, the system SHALL write one `AuditLog` entry per device noting the template name and setting count.
- IF any device fails mid-apply, the system SHALL continue applying to remaining devices and return a partial-success response.

---

## Device Tags

### US-007-3: Filter dashboard by tag
As any user, I want to filter the device dashboard by one or more tags, so that I can focus on a subset of devices.

**Acceptance criteria**
- WHEN a user selects one or more tags in the filter bar, the system SHALL update the URL query params and reload the device list with only matching devices.
- WHEN no tags are selected, the system SHALL show all devices.
- WHEN a filter is active, the system SHALL show a "Clear filters" link.

### US-007-4: Bulk action by tag
As an admin, I want to send a command to all devices with a specific tag, so that I can target logical groups without manually selecting devices.

**Acceptance criteria**
- WHEN an admin chooses "Send command to tag", the system SHALL resolve all devices with the selected tag, validate provider homogeneity, and forward to `POST /api/devices/bulk/command`.
- IF the tag resolves to zero devices, the system SHALL show "No devices with this tag" and SHALL NOT send any command.
- IF the resolved devices have mixed providers, the system SHALL show "Mixed providers — select a single-provider tag" and SHALL NOT send any command.

---

## Alerting

### US-007-5: Alert when a device goes offline
As an admin, I want to be notified when a device goes offline, so that I can respond before it affects users.

**Acceptance criteria**
- WHEN a device transitions from online to offline (detected via polling or MQTT `networkDisconnect`), the system SHALL evaluate all alert rules for that device.
- WHERE an alert rule for `OFFLINE` is active for the device (or "all devices"), the system SHALL create an in-app notification.
- WHERE SMTP is configured and the alert rule has `emailEnabled: true`, the system SHALL send an email to the configured recipient address.

### US-007-6: Alert on battery threshold
As an admin, I want to be alerted when a device's battery drops below a configured level, so that I can dispatch a charge before the device dies.

**Acceptance criteria**
- WHEN a device's `batteryLevel` drops below an alert rule's `threshold` value, the system SHALL fire the alert.
- The alert SHALL NOT re-fire for the same device until battery has recovered above the threshold and dropped again.

### US-007-7: Alert on power disconnected
As an admin, I want to be notified when a device is unplugged from power, so that I can investigate potential theft or cable issues.

**Acceptance criteria**
- WHEN a `unplugged` MQTT event (or polling state change) is detected, the system SHALL fire an `UNPLUGGED` alert for the device if a matching rule exists.

---

## Non-functional Requirements
- Alert emails use nodemailer; SMTP config is stored in app config (see spec 005 config table).
- In-app notifications are stored in a `Notification` DB table and surfaced in a bell icon in the nav.
- Alert rules can target a specific device or all devices (`deviceId: null`).

## Out of Scope
- Webhook / Slack / PagerDuty alert destinations.
- Alert snooze or acknowledgement flow.
- Template version history or diffing.
