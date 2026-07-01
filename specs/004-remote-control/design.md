# 004 — Remote Control: Design

## API Routes

### `POST /api/devices/[id]/command`
**Body:** `{ cmd: string, params?: Record<string, string> }`

1. Auth guard — require `ADMIN`.
2. Load device from DB; resolve provider.
3. For commands that require a capability (screensaver, TTS), call `assertCapability`.
4. Validate `cmd`-specific params (e.g. volume range).
5. Decrypt device password; forward to `provider.sendCommand(device, cmd, params)`.
6. Write `AuditLog` entry.
7. Return `200 { ok: true }` or propagate error.

**Error mapping:**
- `ProviderCapabilityError` → `501`
- `ProviderError` (4xx/5xx from device) → `502 Bad Gateway` with device status in body
- Zod validation failure → `400`

---

### `POST /api/devices/bulk/command`
**Body:** `{ cmd: string, params?: Record<string, string>, deviceIds: string[] }`

1. Auth guard — require `ADMIN`.
2. Fetch all devices by IDs.
3. Validate all devices share the same provider — if not, return `400`.
4. Run `Promise.allSettled(deviceIds.map(id => sendToDevice(id, cmd, params)))`.
5. Write one `AuditLog` entry per device.
6. Return `{ succeeded: string[], failed: { id: string, error: string }[] }`.

---

## UI Components

### `DeviceControls` (Client Component)
Props: `deviceId: string, capabilities: ProviderCapabilities`

Sections (only rendered if capability is `true`):
- **Power** — Screen On, Screen Off
- **Navigation** — Load URL (with input), Reload Start URL
- **App** — Restart App, Lock/Unlock Kiosk
- **Screensaver** — Start, Stop
- **Audio** — Volume slider, TTS (with text input)

Each button:
- `onClick` → `POST /api/devices/[id]/command`
- While loading: `disabled + Spinner`
- On success: `toast.success()`
- On error: `toast.error(message)`

### Dashboard bulk action bar
- Appears when ≥ 1 device is selected.
- Dropdown of common commands (Screen On, Screen Off, Load URL, Reload).
- Validates all selected devices share a provider before enabling "Send".

## Volume validation
```ts
const setVolumeSchema = z.object({
  cmd: z.literal('setVolume'),
  params: z.object({ level: z.coerce.number().min(0).max(100) }),
})
```
