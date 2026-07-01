# 008 — Audit Log: Requirements

## User Stories

### US-008-1: Automatic command auditing
As an admin, I want every command, setting change, and template application to be automatically recorded with who did it and when, so that I have a complete audit trail without any manual effort.

**Acceptance criteria**
- WHEN any `POST /api/devices/[id]/command`, `PUT /api/devices/[id]`, or `POST /api/templates/[id]/apply` succeeds, the system SHALL write an `AuditLog` row with `userId`, `deviceId`, `action`, `payload`, and `createdAt`.
- The system shall write audit entries even when the action partially fails (e.g. bulk command with some device errors).
- Audit entries SHALL be immutable — no update or delete operations on `AuditLog` rows.

### US-008-2: View audit log (global)
As an admin, I want to browse a paginated list of all audit entries, so that I can review what changes have been made across the fleet.

**Acceptance criteria**
- WHEN an admin opens `/audit`, the system SHALL display audit entries in reverse chronological order with user, device name, action, and relative time.
- The audit list SHALL support filtering by `deviceId`, `userId`, `action` type, and date range via query params.
- The audit list SHALL paginate at 50 entries per page.

### US-008-3: View audit log (per device)
As an admin, I want to see the audit history for a specific device on its detail page, so that I can trace what has been done to that device.

**Acceptance criteria**
- WHEN an admin opens a device detail page, the system SHALL show the last 20 audit entries for that device in a collapsible panel.
- WHEN a user clicks "View all" in the panel, the system SHALL navigate to `/audit?deviceId=[id]`.

### US-008-4: Settings change auditing
As an admin, I want settings changes to be recorded with the key, old value, and new value, so that I can roll back unintended configuration changes manually.

**Acceptance criteria**
- WHEN `provider.setSetting` is called, the API route SHALL first fetch the current value, then record `{ key, oldValue, newValue }` in the `AuditLog.payload`.
- IF fetching the current value fails (device unreachable), the system SHALL still proceed with the setting change and record `{ key, oldValue: null, newValue }`.

---

## Non-functional Requirements
- Audit log must be retained indefinitely — it is not subject to the same retention window as `DeviceStatusHistory`.
- `AuditLog.payload` is a JSON column; its schema is action-specific and validated by the writing code, not by the DB.
- The `/audit` page is ADMIN-only.

## Out of Scope
- Real-time push of audit entries to the browser via SSE.
- Exporting the full audit log to CSV (ADMIN can query via the paginated API).
