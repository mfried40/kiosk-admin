# 006 — Monitoring & Status History: Design

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/devices/[id]/screenshot` | Proxy PNG from provider |
| GET | `/api/devices/[id]/history` | History rows, supports `?from=&to=` |
| GET | `/api/devices/[id]/logs` | Proxy log text from provider |
| GET | `/api/devices/[id]/usage-stats` | Proxy CSV from provider |

### `GET /api/devices/[id]/screenshot`
1. Load device, resolve provider, `assertCapability('hasScreenshot')`.
2. Call `provider.getScreenshot(device)` — returns `Buffer`.
3. Return `new Response(buffer, { headers: { 'Content-Type': 'image/png' } })`.
4. No caching — always live.

### `GET /api/devices/[id]/history`
1. Parse `from` / `to` query params (ISO 8601); default to last 7 days.
2. Query `DeviceStatusHistory` for `deviceId` within range, ordered `recordedAt ASC`.
3. Return array of `{ recordedAt, online, batteryLevel, screenOn, currentUrl }`.

### History insert + prune (in `lib/history.ts`)
```ts
export async function recordStatus(deviceId: string, info: DeviceInfo) {
  const retentionDays = await getRetentionDays() // from app config
  await db.$transaction([
    db.deviceStatusHistory.create({ data: { deviceId, ...info, recordedAt: new Date() } }),
    db.deviceStatusHistory.deleteMany({
      where: {
        deviceId,
        recordedAt: { lt: subDays(new Date(), retentionDays) }
      }
    })
  ])
}
```

## UI Components

### `ScreenshotPanel` (Client Component)
- Renders `<img src="/api/devices/[id]/screenshot" />` inside a fixed-aspect-ratio container.
- "Refresh" button re-fetches by appending `?t=Date.now()` to bust browser cache.
- Shows `Skeleton` while loading.
- On 501: renders "Screenshots not supported by this provider".
- On network error: renders "Device offline".

### `StatusHistoryCharts`
- Uses Recharts (or similar lightweight library).
- **Battery trend**: `<LineChart>` of `batteryLevel` over time.
- **Uptime bar**: `<BarChart>` — green/red bars per hour based on `online` snapshots.
- Fetches from `/api/devices/[id]/history?from=...&to=...` on mount.

### `LogPanel` (Client Component)
- Lazy-loaded accordion on device detail page.
- On expand: fetches `/api/devices/[id]/logs`.
- Renders in `<pre className="font-mono text-xs overflow-auto max-h-96">`.
- "Copy" button for full log text.

## Data Model (relevant slice)
```prisma
model DeviceStatusHistory {
  id           String   @id @default(uuid())
  deviceId     String
  online       Boolean
  batteryLevel Float?
  currentUrl   String?
  screenOn     Boolean?
  recordedAt   DateTime @default(now())

  device       Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([deviceId, recordedAt])
}
```
