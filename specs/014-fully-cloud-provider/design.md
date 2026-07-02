# 014 — Fully Cloud Provider: Design

## Database mapping (no schema migration required)

The existing `Device` model fields are repurposed for Fully Cloud:

| Field | Local Fully Kiosk | Fully Cloud |
|---|---|---|
| `ipAddress` | Device local IP | Fully Cloud account email (`apiemail`) |
| `port` | REST API port (2323) | Unused — store `0` or `2323` |
| `passwordEnc` | Encrypted device password | Encrypted API key (`apikey`) |
| `mqttDeviceId` | MQTT topic device ID | Fully Cloud device ID (`devid`) |

This avoids any schema migration. The `ipAddress` field holds the account email for cloud devices; the UI shows different labels based on the selected provider.

---

## `lib/providers/fully-cloud.ts` (new)

```ts
export class FullyCloudProvider extends BaseKioskProvider {
  static readonly capabilities: ProviderCapabilities = {
    // Same as FULLY_KIOSK except:
    hasScreenshot: false,   // not available via cloud API
    hasCamshot: false,      // not available via cloud API
    hasMqttCommands: false,
    // all other caps: true (same firmware as local)
    ...
  };

  private email(device: Device): string  { return device.ipAddress; }
  private apiKey(device: Device): string { return decrypt(device.passwordEnc ?? ""); }
  private devId(device: Device): string  { return device.mqttDeviceId ?? ""; }

  private cloudUrl(path: string, device: Device, extra?: Record<string, string>): string {
    const u = new URL(`https://api.fully-kiosk.com/${path}`);
    u.searchParams.set("apiemail", this.email(device));
    u.searchParams.set("apikey", this.apiKey(device));
    u.searchParams.set("devid", this.devId(device));
    if (extra) for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    return u.toString();
  }

  async getDeviceInfo(device: Device): Promise<DeviceInfo> { ... }
  async sendCommand(device: Device, cmd: string, params?): Promise<unknown> { ... }
  async flushQueue(device: Device): Promise<void> { ... }
  
  // Unsupported — throws ProviderCapabilityError
  async getScreenshot(device: Device): Promise<Buffer> { ... }
  async getCamshot(device: Device): Promise<Buffer> { ... }
}
```

### `getDeviceInfo` implementation
```
GET https://api.fully-kiosk.com/cloud/devices?apiemail=...&apikey=...&devid=...

Response: JSON array — take first element
Map fields:
  batteryLevel    ← data[0].heartbeatInfo.batteryLevel
  screenOn        ← data[0].heartbeatInfo.screenOn
  currentUrl      ← data[0].heartbeatInfo.currentPageUrl
  deviceModel     ← data[0].heartbeatInfo.model
  androidVersion  ← data[0].heartbeatInfo.androidVersion
  appVersion      ← data[0].heartbeatInfo.version
  online          ← data[0].heartbeatInfo !== null (has recent heartbeat)
```

### `sendCommand` implementation
```
GET https://api.fully-kiosk.com/remote/?apiemail=...&apikey=...&devid=...
  &cmd={cmd}&persistent=1&{...params}

Response: one JSON line per device
  { status: "OK", statustext: "...", deviceID: "..." }   → success
  { status: "Error", statustext: "..." }                  → throw ProviderError
```

---

## Rate limiting: `lib/providers/cloud-rate-limiter.ts` (new)

A simple token-bucket limiter shared across all Fully Cloud calls:

```ts
// Max 8 req/sec (conservative under the 10/sec limit)
const limiter = new RateLimiter({ tokensPerSecond: 8, maxTokens: 8 });

export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  await limiter.acquire(); // blocks until a token is available
  return fn();
}
```

All `FullyCloudProvider` HTTP calls are wrapped in `withRateLimit()`.

---

## Account device discovery: `POST /api/devices/probe` (extension)

When `provider === "FULLY_CLOUD"` the probe endpoint calls:
```
GET https://api.fully-kiosk.com/cloud/devices?apiemail=...&apikey=...
```
(no `devid` → returns all devices on the account)

Returns a list of `{ devid, deviceAlias, online }` for the admin to choose from.

The form shows a dropdown/list instead of the single auto-populate behaviour used for local providers.

---

## DeviceForm changes

| Field | Local label | FULLY_CLOUD label |
|---|---|---|
| `ipAddress` | IP Address | Account Email |
| `port` | Port | *(hidden)* |
| `password` | Password | API Key |
| `mqttDeviceId` | MQTT Device ID | Cloud Device ID |

"Fetch" for FULLY_CLOUD calls the probe endpoint → shows a device picker dropdown.
The selected device populates `name` (from `deviceAlias`) and `mqttDeviceId` (from `devid`).

---

## `lib/capabilities.ts` addition

```ts
const FULLY_CLOUD_CAPS: ProviderCapabilities = {
  ...FULLY_KIOSK_CAPS,
  hasScreenshot: false,
  hasCamshot: false,
};
```

---

## Prisma schema addition

```prisma
enum Provider {
  FULLY_KIOSK
  FREE_KIOSK
  FULLY_CLOUD   // ← add this
}
```

Requires `prisma migrate dev --name add_fully_cloud_provider`.

---

## Error mapping

| Fully Cloud response | Kiosk Admin error |
|---|---|
| `status: "Error"`, any | `ProviderError(502, statustext)` |
| HTTP 429 | Retry up to 3× with 1 s delay |
| Network timeout (8 s) | `ProviderError(503, "Device timed out")` |
| Empty device array | `{ online: false }` |
