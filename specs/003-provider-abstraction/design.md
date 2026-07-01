# 003 — Provider Abstraction: Design

## Types (`lib/provider.types.ts`)

```ts
export interface DeviceInfo {
  online: boolean
  batteryLevel?: number
  screenOn?: boolean
  currentUrl?: string
  deviceModel?: string
  androidVersion?: string
  appVersion?: string
  storageTotal?: number
  storageFree?: number
}

export interface ProviderCapabilities {
  hasScreenshot: boolean
  hasScreenControl: boolean   // screen on/off
  hasUrlControl: boolean      // load URL, reload
  hasAppRestart: boolean
  hasKioskLock: boolean
  hasScreensaver: boolean
  hasTTS: boolean
  hasVolume: boolean
  hasFileManagement: boolean
  hasAppManagement: boolean
  hasUsageStats: boolean
  hasLogViewer: boolean
  hasCamshot: boolean
}

export interface KioskProvider {
  getDeviceInfo(device: Device): Promise<DeviceInfo>
  getScreenshot(device: Device): Promise<Buffer>
  sendCommand(device: Device, cmd: string, params?: Record<string, string>): Promise<unknown>
  getSettings(device: Device): Promise<Record<string, string>>
  setSetting(device: Device, key: string, value: string): Promise<void>
  getFiles(device: Device, path: string): Promise<FileEntry[]>
  getLogs(device: Device): Promise<string>
}

export abstract class BaseKioskProvider implements KioskProvider {
  static readonly capabilities: ProviderCapabilities
  abstract getDeviceInfo(device: Device): Promise<DeviceInfo>
  // ... other abstract methods
}

export class ProviderCapabilityError extends Error {
  constructor(provider: string, capability: string) {
    super(`${provider} does not support ${capability}`)
    this.name = 'ProviderCapabilityError'
  }
}

export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ProviderError'
  }
}
```

## Resolver (`lib/providers/index.ts`)

```ts
import { FullyKioskProvider } from './fully-kiosk'
import { FreeKioskProvider } from './free-kiosk'
import { Provider } from '@prisma/client'
import type { BaseKioskProvider } from '../provider.types'

const PROVIDERS: Record<Provider, new () => BaseKioskProvider> = {
  [Provider.FULLY_KIOSK]: FullyKioskProvider,
  [Provider.FREE_KIOSK]: FreeKioskProvider,
}

export function getProvider(provider: Provider): BaseKioskProvider {
  const Cls = PROVIDERS[provider]
  return new Cls()
}

export function getCapabilities(provider: Provider): ProviderCapabilities {
  const Cls = PROVIDERS[provider]
  return (Cls as typeof BaseKioskProvider).capabilities
}
```

## Fully Kiosk provider (`lib/providers/fully-kiosk.ts`)

- Base URL: `http://{device.ipAddress}:{device.port}`
- All calls: `GET /?cmd={cmd}&password={decryptedPassword}&{...params}`
- `getDeviceInfo`: calls `?cmd=deviceInfo`, maps JSON response to `DeviceInfo`
- `getScreenshot`: calls `?cmd=screenshot`, returns raw PNG buffer
- `sendCommand`: generic command proxy
- `getSettings`: `?cmd=listSettings`
- `setSetting`: `?cmd=setStringSetting&key=...&value=...`
- Timeout: 5 000 ms via `AbortController`
- All capabilities: `true`

## Capability gate in API routes

```ts
// Utility to use in route handlers
export function assertCapability(provider: Provider, cap: keyof ProviderCapabilities) {
  const caps = getCapabilities(provider)
  if (!caps[cap]) {
    throw new ProviderCapabilityError(provider, cap)
  }
}
```

Route handler catches `ProviderCapabilityError` and returns `501`.
