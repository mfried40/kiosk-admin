# 007 — Config Templates, Tags & Alerting: Design

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/templates` | any | List templates |
| POST | `/api/templates` | ADMIN | Create template |
| PUT | `/api/templates/[id]` | ADMIN | Update template |
| DELETE | `/api/templates/[id]` | ADMIN | Delete template |
| POST | `/api/templates/[id]/apply` | ADMIN | Apply to `{ deviceIds }` |
| GET | `/api/alerts` | any | List alert rules |
| POST | `/api/alerts` | ADMIN | Create alert rule |
| PUT | `/api/alerts/[id]` | ADMIN | Update alert rule |
| DELETE | `/api/alerts/[id]` | ADMIN | Delete alert rule |

## Template apply logic (`lib/templates.ts`)
```ts
export async function applyTemplate(templateId: string, deviceIds: string[]) {
  const template = await db.configTemplate.findUniqueOrThrow({ where: { id: templateId } })
  const devices = await db.device.findMany({ where: { id: { in: deviceIds } } })

  const wrongProvider = devices.filter(d => d.provider !== template.provider)
  if (wrongProvider.length > 0) throw new Error('Provider mismatch')

  const results = await Promise.allSettled(
    devices.map(device => applyToDevice(template, device))
  )
  return results
}
```

## Alerting (`lib/alerts.ts`)
- `AlertEvent` union type: `'OFFLINE' | 'BATTERY' | 'UNPLUGGED'`.
- `evaluateAlerts(deviceId, event, payload)`:
  1. Find all active `AlertRule` rows matching `deviceId` (or `deviceId IS NULL`).
  2. For `BATTERY` events: check threshold crossing logic.
  3. For each matching rule: write `Notification` row + optionally send email.
- Called from MQTT handlers and polling path.

## Data Models
```prisma
model ConfigTemplate {
  id        String   @id @default(uuid())
  name      String
  provider  Provider
  settings  Json
  createdAt DateTime @default(now())
  @@unique([name, provider])
}

model AlertRule {
  id           String    @id @default(uuid())
  deviceId     String?   // null = all devices
  type         AlertType
  threshold    Float?    // for BATTERY type
  emailEnabled Boolean   @default(false)
  emailTo      String?
  active       Boolean   @default(true)
}

model Notification {
  id        String   @id @default(uuid())
  deviceId  String?
  type      AlertType
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

enum AlertType {
  OFFLINE
  BATTERY
  UNPLUGGED
}
```

## Battery threshold hysteresis
Store `lastBatteryAlertLevel` on `Device` or in a transient in-memory map. Only fire alert when:
- `current < threshold` AND `lastLevel >= threshold`

Reset when battery rises above threshold again.

## UI
- **`/templates` page**: table of templates, "Apply" button opens device multi-select modal.
- **Alert rules section on `/settings` page**: simple list, add/edit/delete inline.
- **Bell icon in nav**: badge count of unread notifications; dropdown shows last 10.
