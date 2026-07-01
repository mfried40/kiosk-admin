# 002 — Device Management: Design

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/devices` | any | List devices; supports `?groupId=`, `?tagId=`, `?search=` |
| POST | `/api/devices` | ADMIN | Create device |
| GET | `/api/devices/[id]` | any | Get single device (no password) |
| PUT | `/api/devices/[id]` | ADMIN | Update device |
| DELETE | `/api/devices/[id]` | ADMIN | Delete device + cascade |
| GET | `/api/devices/[id]/info` | any | Fetch live DeviceInfo from provider |
| GET | `/api/groups` | any | List groups |
| POST | `/api/groups` | ADMIN | Create group |
| PUT | `/api/groups/[id]` | ADMIN | Update group |
| DELETE | `/api/groups/[id]` | ADMIN | Delete group (nullifies device.groupId) |
| GET | `/api/tags` | any | List all tags |
| POST | `/api/tags` | ADMIN | Create tag |
| DELETE | `/api/tags/[id]` | ADMIN | Delete tag |
| POST | `/api/devices/[id]/tags` | ADMIN | Sync tags on device `{ tagIds: string[] }` |

## Key Decisions

**Password field on edit:** The PUT body uses a discriminated union:
```ts
type UpdateDeviceBody =
  | { password: string }          // re-encrypt new password
  | { password: undefined }       // leave existing password unchanged
```
Never send the decrypted password back in a GET response — omit the field entirely.

**Device status fetch strategy:**
- `GET /api/devices` returns persisted data only (fast).
- `GET /api/devices/[id]/info` performs a live HTTP call to the device via the provider, with a 5 s timeout.
- Dashboard page fetches all devices, then fires individual `/info` requests client-side in parallel.
- Offline devices resolve to `{ online: false, lastSeen: device.updatedAt }`.

**Tag sync:** `POST /api/devices/[id]/tags` accepts `{ tagIds }` and does a full replace (delete existing `DeviceTags`, insert new ones) in a Prisma transaction.

## Data Model (relevant slice)
```prisma
model Device {
  id            String              @id @default(uuid())
  name          String
  ipAddress     String
  port          Int
  passwordEnc   String              // AES-256-GCM encrypted
  provider      Provider
  mqttDeviceId  String?
  groupId       String?
  group         Group?              @relation(fields: [groupId], references: [id])
  tags          DeviceTag[]
  history       DeviceStatusHistory[]
  auditLogs     AuditLog[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}

model Group {
  id          String   @id @default(uuid())
  name        String
  description String?
  devices     Device[]
}

model Tag {
  id      String      @id @default(uuid())
  name    String      @unique
  devices DeviceTag[]
}

model DeviceTag {
  deviceId String
  tagId    String
  device   Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  tag      Tag    @relation(fields: [tagId], references: [id])
  @@id([deviceId, tagId])
}

enum Provider {
  FULLY_KIOSK
  FREE_KIOSK
}
```

## UI Components
- `DeviceCard` — shows name, IP, provider badge, group, tags, online indicator, battery.
- `DeviceForm` — shared add/edit form. Password field shows placeholder when editing (never pre-filled).
- `GroupBadge` — inline group label with link.
- `TagFilter` — multi-select tag filter on dashboard, syncs to query params.
