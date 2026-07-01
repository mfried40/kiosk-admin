# 008 — Audit Log: Design

## `lib/audit.ts`
```ts
export interface AuditPayload {
  cmd?: string
  params?: Record<string, string>
  key?: string
  oldValue?: string | null
  newValue?: string
  templateId?: string
  templateName?: string
  settingCount?: number
}

export async function writeAuditLog(
  userId: string,
  action: string,
  payload?: AuditPayload,
  deviceId?: string
): Promise<void> {
  await db.auditLog.create({
    data: { userId, deviceId, action, payload: payload ?? Prisma.JsonNull }
  })
}
```

Called from:
- `POST /api/devices/[id]/command` — action: `sendCommand`, payload: `{ cmd, params }`
- `PUT /api/devices/[id]` — action: `updateDevice`, payload: `{ fields: changedFieldNames }`
- `POST /api/templates/[id]/apply` — action: `applyTemplate`, payload: `{ templateId, templateName, settingCount }`
- `PUT /api/devices/[id]/settings/[key]` — action: `setSetting`, payload: `{ key, oldValue, newValue }`

## API Routes

### `GET /api/audit`
- ADMIN only.
- Query params: `deviceId?`, `userId?`, `action?`, `from?`, `to?`, `page?` (default 1), `pageSize?` (default 50).
- Returns `{ entries: AuditEntry[], total: number, page: number }`.
- Joins `User` (email) and `Device` (name) for display.

## Data Model
```prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  deviceId  String?
  action    String
  payload   Json?
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  device    Device?  @relation(fields: [deviceId], references: [id], onDelete: SetNull)

  @@index([deviceId, createdAt])
  @@index([createdAt])
}
```

## UI Components

### `/audit` page (ADMIN only)
- Server Component: SSR first page with filters in URL params.
- Filter bar: device dropdown, action type dropdown, date range picker.
- Table columns: Time (relative), User, Device, Action, Payload summary.
- Pagination controls.

### `AuditPanel` on device detail page
- Client Component: fetches `/api/audit?deviceId=[id]&pageSize=20`.
- Collapsible accordion — collapsed by default.
- "View all" link → `/audit?deviceId=[id]`.
