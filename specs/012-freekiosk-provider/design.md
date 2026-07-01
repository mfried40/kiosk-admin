# 012 — FreeKiosk Provider: Design

## Overview

The FreeKiosk provider replaces the existing stub in `lib/providers/free-kiosk.ts`.
It implements `BaseKioskProvider` by translating the internal command vocabulary into
FreeKiosk's REST API (`POST /api/<path>` with JSON bodies and `X-Api-Key` header auth).

---

## Capability Flags

| Flag                | FULLY_KIOSK | FREE_KIOSK | FreeKiosk endpoint |
|---------------------|-------------|------------|--------------------|
| `hasScreenshot`     | ✅ | ✅ | `GET /api/screenshot` |
| `hasScreenControl`  | ✅ | ✅ | `POST /api/screen/on`, `/api/screen/off` |
| `hasUrlControl`     | ✅ | ✅ | `POST /api/url`, `POST /api/reload` |
| `hasAppRestart`     | ✅ | ✅ | `POST /api/restart-ui` |
| `hasScreensaver`    | ✅ | ✅ | `POST /api/screensaver/on`, `/off`, `/api/wake` |
| `hasTTS`            | ✅ | ✅ | `POST /api/tts` |
| `hasVolume`         | ✅ | ✅ | `POST /api/volume` |
| `hasCamshot`        | ✅ | ✅ | `GET /api/camera/photo` |
| `hasMediaPlayer`    | ✅ | ✅ | `POST /api/audio/play`, `/stop`, `/beep` |
| `hasMaintenance`    | ✅ | ✅ | `POST /api/reboot`, `POST /api/lock` |
| `hasAppLauncher`    | ✅ | ✅ | `POST /api/app/launch` |
| `hasInjectJS`       | ✅ | ✅ | `POST /api/js` |
| `hasFileManagement` | ✅ | ❌ | — |
| `hasFileTransfer`   | ✅ | ❌ | — |
| `hasApkManagement`  | ✅ | ❌ | — |
| `hasTabManagement`  | ✅ | ❌ | — |
| `hasLogViewer`      | ✅ | ❌ | — |
| `hasAppManagement`  | ✅ | ❌ | — |

---

## Provider Class (`lib/providers/free-kiosk.ts`)

```ts
import type { Device } from "@/lib/generated/prisma";
import { decrypt } from "@/lib/crypto";
import type { DeviceInfo, FileEntry } from "@/lib/provider.types";
import {
  BaseKioskProvider,
  ProviderCapabilityError,
  ProviderError,
} from "@/lib/provider.types";

const TIMEOUT_MS = 8_000;

export class FreeKioskProvider extends BaseKioskProvider {
  static readonly capabilities = {
    hasScreenshot:     true,
    hasScreenControl:  true,
    hasUrlControl:     true,
    hasAppRestart:     true,
    hasScreensaver:    true,
    hasTTS:            true,
    hasVolume:         true,
    hasCamshot:        true,
    hasMediaPlayer:    true,
    hasMaintenance:    true,
    hasAppLauncher:    true,
    hasInjectJS:       true,
    hasFileManagement: false,
    hasFileTransfer:   false,
    hasApkManagement:  false,
    hasTabManagement:  false,
    hasLogViewer:      false,
    hasAppManagement:  false,
  } as const;

  private baseUrl(device: Device): string {
    return `http://${device.ip}:${device.port}`;
  }

  private apiKey(device: Device): string | null {
    if (!device.password) return null;
    return decrypt(device.password);
  }

  private async request(
    device: Device,
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    binary?: boolean,
  ): Promise<unknown> {
    const url = `${this.baseUrl(device)}${path}`;
    const key = this.apiKey(device);
    const headers: Record<string, string> = {};
    if (key) headers["X-Api-Key"] = key;
    if (body) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new ProviderError(res.status, await res.text());
      }

      if (binary) return Buffer.from(await res.arrayBuffer());
      return (await res.json()) as unknown;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new ProviderError(503, "Request timed out");
      }
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(503, (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getDeviceInfo(device: Device): Promise<DeviceInfo> {
    // Fetch status + info in parallel; info may fail gracefully
    const [statusRes, infoRes] = await Promise.allSettled([
      this.request(device, "GET", "/api/status"),
      this.request(device, "GET", "/api/info"),
    ]);

    if (statusRes.status === "rejected") throw statusRes.reason;

    const status = (statusRes.value as { data: FreeKioskStatus }).data;
    const info =
      infoRes.status === "fulfilled"
        ? (infoRes.value as { data: FreeKioskInfo }).data
        : null;

    return {
      online: true,
      batteryLevel: status.battery?.level,
      screenOn: status.screen?.on,
      currentUrl: status.webview?.currentUrl,
      deviceModel: status.device?.model,
      androidVersion: status.device?.android,
      appVersion: info?.version,
      storageTotal: status.storage?.totalMB
        ? status.storage.totalMB * 1024 * 1024
        : undefined,
      storageFree: status.storage?.availableMB
        ? status.storage.availableMB * 1024 * 1024
        : undefined,
    };
  }

  async getScreenshot(device: Device): Promise<Buffer> {
    return (await this.request(device, "GET", "/api/screenshot", undefined, true)) as Buffer;
  }

  async getCamshot(device: Device, params?: Record<string, string>): Promise<Buffer> {
    const qs = new URLSearchParams();
    if (params?.camera) qs.set("camera", params.camera);
    if (params?.quality) qs.set("quality", params.quality);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return (await this.request(device, "GET", `/api/camera/photo${query}`, undefined, true)) as Buffer;
  }

  async sendCommand(
    device: Device,
    cmd: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    switch (cmd) {
      // Screen
      case "screenOn":      return this.request(device, "POST", "/api/screen/on");
      case "screenOff":     return this.request(device, "POST", "/api/screen/off");

      // URL / browser
      case "loadUrl":       return this.request(device, "POST", "/api/url", { url: params?.url });
      case "reload":        return this.request(device, "POST", "/api/reload");
      case "clearCache":    return this.request(device, "POST", "/api/clearCache");

      // App restart
      case "restartApp":    return this.request(device, "POST", "/api/restart-ui");

      // Screensaver
      case "startScreensaver": return this.request(device, "POST", "/api/screensaver/on");
      case "stopScreensaver":  return this.request(device, "POST", "/api/screensaver/off");
      case "wake":             return this.request(device, "POST", "/api/wake");

      // TTS
      case "textToSpeech": {
        const body: Record<string, string> = { text: params?.text ?? "" };
        if (params?.language) body.language = params.language;
        return this.request(device, "POST", "/api/tts", body);
      }

      // Volume
      case "setVolume":
        return this.request(device, "POST", "/api/volume", { value: Number(params?.level ?? 50) });

      // Brightness
      case "setBrightness":
        return this.request(device, "POST", "/api/brightness", { value: Number(params?.value ?? 50) });
      case "enableAutoBrightness":
        return this.request(device, "POST", "/api/autoBrightness/enable", {
          min: params?.min ? Number(params.min) : undefined,
          max: params?.max ? Number(params.max) : undefined,
          offset: params?.offset ? Number(params.offset) : undefined,
        });
      case "disableAutoBrightness":
        return this.request(device, "POST", "/api/autoBrightness/disable");

      // Audio
      case "playFile":
        return this.request(device, "POST", "/api/audio/play", {
          url: params?.url,
          loop: params?.loop === "true",
          volume: params?.volume ? Number(params.volume) : undefined,
        });
      case "stopMedia":  return this.request(device, "POST", "/api/audio/stop");
      case "beep":       return this.request(device, "POST", "/api/audio/beep");

      // Maintenance
      case "reboot": return this.request(device, "POST", "/api/reboot");
      case "lock":   return this.request(device, "POST", "/api/lock");

      // App launcher
      case "startApplication":
        return this.request(device, "POST", "/api/app/launch", { package: params?.package });

      // JS injection
      case "injectJS":
        return this.request(device, "POST", "/api/js", { code: params?.code });

      // Toast
      case "toast":
        return this.request(device, "POST", "/api/toast", { text: params?.text });

      // Display mode
      case "switchMode":
        return this.request(device, "POST", "/api/mode", {
          mode: params?.mode,
          ...(params?.url ? { url: params.url } : {}),
          ...(params?.package ? { package: params.package } : {}),
        });

      default:
        throw new ProviderCapabilityError("FREE_KIOSK", cmd);
    }
  }

  async getSettings(_device: Device): Promise<Record<string, string>> {
    throw new ProviderCapabilityError("FREE_KIOSK", "getSettings");
  }

  async setSetting(_device: Device, _key: string, _value: string): Promise<void> {
    throw new ProviderCapabilityError("FREE_KIOSK", "setSetting");
  }

  async getFiles(_device: Device, _path: string): Promise<FileEntry[]> {
    throw new ProviderCapabilityError("FREE_KIOSK", "getFiles");
  }

  async getLogs(_device: Device): Promise<string> {
    throw new ProviderCapabilityError("FREE_KIOSK", "getLogs");
  }
}

// --- Internal response shape types ---

interface FreeKioskStatus {
  battery?: { level?: number; charging?: boolean };
  screen?: { on?: boolean; brightness?: number; screensaverActive?: boolean };
  webview?: { currentUrl?: string };
  device?: { model?: string; manufacturer?: string; android?: string };
  storage?: { totalMB?: number; availableMB?: number };
  audio?: { volume?: number };
}

interface FreeKioskInfo {
  version?: string;
  isDeviceOwner?: boolean;
  kioskMode?: boolean;
}
```

---

## `lib/capabilities.ts` changes

Update the `FREE_KIOSK` entry:

```ts
[Provider.FREE_KIOSK]: {
  hasScreenshot:     true,
  hasScreenControl:  true,
  hasUrlControl:     true,
  hasAppRestart:     true,
  hasScreensaver:    true,
  hasTTS:            true,
  hasVolume:         true,
  hasCamshot:        true,
  hasMediaPlayer:    true,
  hasMaintenance:    true,
  hasAppLauncher:    true,
  hasInjectJS:       true,
  hasFileManagement: false,
  hasFileTransfer:   false,
  hasApkManagement:  false,
  hasTabManagement:  false,
  hasLogViewer:      false,
  hasAppManagement:  false,
},
```

---

## Authentication flow

```
device.password (encrypted AES-256-GCM in DB)
  ↓ decrypt()
plaintext API key
  ↓
X-Api-Key: <key>   (request header, never in URL or logs)
```

If `device.password` is null/empty → no header sent (device has no API key configured).

---

## Error mapping

| Scenario | Thrown |
|---|---|
| HTTP 4xx/5xx from device | `ProviderError(status, body)` |
| Network failure | `ProviderError(503, message)` |
| Request timeout (8 s) | `ProviderError(503, "Request timed out")` |
| Unsupported command | `ProviderCapabilityError("FREE_KIOSK", cmd)` |
| Unsupported method call | `ProviderCapabilityError("FREE_KIOSK", methodName)` |

---

## Testing strategy

- Mock `fetch` with `vi.fn()` / msw handlers.
- Verify correct URL, method, headers, and body for each `sendCommand` case.
- Verify `getDeviceInfo` correctly maps the `/api/status` JSON shape to `DeviceInfo`.
- Verify timeout triggers `ProviderError(503, "Request timed out")`.
- Verify unsupported commands throw `ProviderCapabilityError`.
- Verify `getSettings`/`setSetting`/`getFiles`/`getLogs` throw `ProviderCapabilityError`.
