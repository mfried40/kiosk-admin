# 002 — Device Management: Requirements

## User Stories

### US-002-1: Add a device
As an admin, I want to register a new device with its IP, port, provider, and credentials, so that I can manage it from the dashboard.

**Acceptance criteria**
- WHEN an admin submits the add-device form with a valid IP/hostname, port, provider, and password, the system SHALL create a `Device` record and encrypt the password before persisting.
- IF the IP address field is empty or not a valid hostname/IP, the system SHALL reject the form with a validation error.
- IF a device with the same IP and port already exists, the system SHALL return a `409 Conflict`.
- WHEN no port is provided, the system SHALL default to the provider's standard port (Fully Kiosk: 2323).

### US-002-2: Edit a device
As an admin, I want to update a device's name, IP, port, provider, group, or password, so that I can correct mistakes or reflect infrastructure changes.

**Acceptance criteria**
- WHEN an admin submits an edit with a new password, the system SHALL re-encrypt it before saving.
- WHEN an admin submits an edit with the password field blank, the system SHALL keep the existing encrypted password unchanged.
- WHEN a device is moved to a different group, the system SHALL update `groupId` and the change SHALL be reflected immediately in the dashboard.

### US-002-3: Remove a device
As an admin, I want to delete a device record, so that stale entries do not clutter the dashboard.

**Acceptance criteria**
- WHEN an admin confirms device deletion, the system SHALL delete the `Device` row and all associated `DeviceTag`, `DeviceStatusHistory`, and `AuditLog` records.
- WHEN deletion is triggered, the system SHALL show a confirmation dialog before proceeding.

### US-002-4: Organise devices into groups
As an admin, I want to assign devices to named groups (e.g. "Floor 1", "Checkout"), so that I can filter and bulk-action by location or function.

**Acceptance criteria**
- The system shall allow a device to belong to at most one group.
- WHEN a group is deleted, the system SHALL set `groupId` to `null` on all member devices.
- WHERE a device has a group, the dashboard SHALL display the group name alongside the device card.

### US-002-5: View live device status
As any authenticated user, I want to see each device's online/offline state, battery level, screen state, and current URL, so that I can quickly spot problems.

**Acceptance criteria**
- WHEN the dashboard loads, the system SHALL attempt to fetch live status for each device by calling the provider's `getDeviceInfo`.
- IF a device is unreachable (network error or timeout ≥ 5 s), the system SHALL mark it as "offline" and SHALL NOT surface the error to the user as a crash.
- WHILE a device is offline, the system SHALL display the last known status with a visual "stale" indicator.
- WHERE MQTT is configured, live status updates SHALL replace polling (see spec 005).

### US-002-6: Tag devices
As an admin, I want to apply free-form tags to devices, so that I can filter and bulk-act by arbitrary criteria.

**Acceptance criteria**
- WHEN an admin adds a tag to a device, the system SHALL create the `Tag` if it does not already exist, then insert a `DeviceTag` join row.
- WHEN a tag is removed from a device, the system SHALL delete the `DeviceTag` join row. If no other devices use that tag, the `Tag` row SHALL remain (tags are not auto-deleted).
- WHEN a user filters the dashboard by tag, the system SHALL show only devices whose `DeviceTags` include the selected tag.

---

## Non-functional Requirements
- Device password must never appear in API responses.
- All device list and detail fetches must be debounced on the client to avoid a thundering herd on page load.
- Group and tag filtering must happen server-side (query parameters) to support large fleets.

## Out of Scope
- Device discovery / auto-scan of the local network.
- Moving devices between groups via drag-and-drop (manual assignment only).
