/**
 * FreeKiosk provider — full implementation.
 * https://github.com/RushB-fr/freekiosk/blob/main/docs/rest-api.md
 */

import {
  BaseKioskProvider,
  ProviderCapabilities,
  ProviderCapabilityError,
  ProviderError,
  FileEntry,
} from "@/lib/provider.types";
import type { DeviceInfo } from "@/lib/types";
import type { Device } from "@/lib/generated/prisma/client";
import { decrypt } from "@/lib/crypto";

const PROVIDER_NAME = "FREE_KIOSK";
const TIMEOUT_MS = 8_000;

// ── Internal response shapes ──────────────────────────────────────────────────

interface FKStatus {
  battery?: { level?: number; charging?: boolean };
  screen?: { on?: boolean; brightness?: number; screensaverActive?: boolean };
  webview?: { currentUrl?: string };
  device?: { model?: string; manufacturer?: string; android?: string };
  storage?: { totalMB?: number; availableMB?: number };
  audio?: { volume?: number };
}

interface FKInfo {
  version?: string;
  isDeviceOwner?: boolean;
  kioskMode?: boolean;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class FreeKioskProvider extends BaseKioskProvider {
  static override readonly capabilities: ProviderCapabilities = {
    hasScreenshot:     true,
    hasScreenControl:  true,
    hasUrlControl:     true,
    hasAppRestart:     true,
    hasKioskLock:      true,  // /api/lock — requires Device Owner or AccessibilityService
    hasScreensaver:    true,
    hasTTS:            true,
    hasVolume:         true,
    hasCamshot:        true,
    hasMediaPlayer:    true,
    hasMaintenance:    true,
    hasAppLauncher:    true,
    hasInjectJS:       true,
    hasFileManagement: false,
    hasAppManagement:  false,
    hasUsageStats:     false,
    hasLogViewer:      false,
    hasTabManagement:  false,
    hasFileTransfer:   false,
    hasApkManagement:  false,
    hasMqttCommands:    true,  // FreeKiosk supports commands via {baseTopic}/{id}/set/{entity}
    hasRemoteControl:   true,  // D-pad + keyboard via /api/remote/*
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  private baseUrl(device: Device): string {
    return `http://${device.ipAddress}:${device.port}`;
  }

  private apiKey(device: Device): string | null {
    if (!device.passwordEnc) return null;
    try { return decrypt(device.passwordEnc); } catch { return null; }
  }

  private async req(
    device: Device,
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    binary = false,
  ): Promise<unknown> {
    const url = `${this.baseUrl(device)}${path}`;
    const key = this.apiKey(device);
    const headers: Record<string, string> = {};
    if (key) headers["X-Api-Key"] = key;
    if (body) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) throw new ProviderError(res.status, await res.text());

      if (binary) return Buffer.from(await res.arrayBuffer());
      return (await res.json()) as unknown;
    } catch (err) {
      if ((err as Error).name === "AbortError")
        throw new ProviderError(503, "Request timed out");
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(503, (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── KioskProvider methods ──────────────────────────────────────────────────

  async getDeviceInfo(device: Device): Promise<DeviceInfo> {
    const [statusRes, infoRes] = await Promise.allSettled([
      this.req(device, "GET", "/api/status"),
      this.req(device, "GET", "/api/info"),
    ]);

    if (statusRes.status === "rejected") throw statusRes.reason;

    const s = (statusRes.value as { data: FKStatus }).data;
    const i =
      infoRes.status === "fulfilled"
        ? (infoRes.value as { data: FKInfo }).data
        : null;

    return {
      online:         true,
      batteryLevel:   s.battery?.level,
      screenOn:       s.screen?.on,
      currentUrl:     s.webview?.currentUrl,
      deviceModel:    s.device?.model,
      androidVersion: s.device?.android,
      appVersion:     i?.version,
      storageTotal:   s.storage?.totalMB != null ? s.storage.totalMB * 1_048_576 : undefined,
      storageFree:    s.storage?.availableMB != null ? s.storage.availableMB * 1_048_576 : undefined,
    };
  }

  async getScreenshot(device: Device): Promise<Buffer> {
    return (await this.req(device, "GET", "/api/screenshot", undefined, true)) as Buffer;
  }

  async getCamshot(device: Device, params?: Record<string, string>): Promise<Buffer> {
    const qs = new URLSearchParams();
    if (params?.camera) qs.set("camera", params.camera);
    if (params?.quality) qs.set("quality", params.quality);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return (await this.req(device, "GET", `/api/camera/photo${suffix}`, undefined, true)) as Buffer;
  }

  async sendCommand(
    device: Device,
    cmd: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    switch (cmd) {
      // Screen
      case "screenOn":    return this.req(device, "POST", "/api/screen/on");
      case "screenOff":
      case "forceSleep":  return this.req(device, "POST", "/api/screen/off");

      // URL / browser
      case "loadUrl":     return this.req(device, "POST", "/api/url", { url: params?.url });
      case "loadStartUrl":
      case "reloadStartUrl":
      case "refreshTab":
      case "reload":      return this.req(device, "POST", "/api/reload");
      case "clearCache":  return this.req(device, "POST", "/api/clearCache");

      // App
      case "restartApp":  return this.req(device, "POST", "/api/restart-ui");

      // Screensaver
      case "startScreensaver":
      case "startDaydream":  return this.req(device, "POST", "/api/screensaver/on");
      case "stopScreensaver":
      case "stopDaydream":   return this.req(device, "POST", "/api/screensaver/off");
      case "wake":             return this.req(device, "POST", "/api/wake");

      // TTS (no stop API in FreeKiosk)
      case "textToSpeech": {
        const body: Record<string, string> = { text: params?.text ?? "" };
        if (params?.language) body.language = params.language;
        return this.req(device, "POST", "/api/tts", body);
      }

      // Volume
      case "setVolume":
      case "setAudioVolume":
        return this.req(device, "POST", "/api/volume", { value: Number(params?.level ?? params?.value ?? 50) });

      // Brightness
      case "setBrightness":
        return this.req(device, "POST", "/api/brightness", { value: Number(params?.value ?? 50) });
      case "enableAutoBrightness":
        return this.req(device, "POST", "/api/autoBrightness/enable", {
          ...(params?.min    != null && { min:    Number(params.min) }),
          ...(params?.max    != null && { max:    Number(params.max) }),
          ...(params?.offset != null && { offset: Number(params.offset) }),
        });
      case "disableAutoBrightness":
        return this.req(device, "POST", "/api/autoBrightness/disable");

      // Audio / media
      case "playSound":
      case "playVideo":
      case "playFile":
        return this.req(device, "POST", "/api/audio/play", {
          url: params?.url,
          loop: params?.loop === "true",
          ...(params?.volume != null && { volume: Number(params.volume) }),
        });
      case "stopSound":
      case "stopVideo":
      case "stopMedia": return this.req(device, "POST", "/api/audio/stop");
      case "beep":      return this.req(device, "POST", "/api/audio/beep");

      // Kiosk / maintenance
      case "lockKiosk":
      case "lock":   return this.req(device, "POST", "/api/lock");
      case "reboot": return this.req(device, "POST", "/api/reboot");

      // App launcher
      case "startApplication":
        return this.req(device, "POST", "/api/app/launch", { package: params?.package });

      // JS injection (standard name: injectJavascript)
      case "injectJavascript":
      case "injectJS":
        return this.req(device, "POST", "/api/js", { code: params?.script ?? params?.code });

      // Overlay / toast (standard name: setOverlayMessage)
      case "setOverlayMessage":
      case "toast":
        return this.req(device, "POST", "/api/toast", { text: params?.message ?? params?.text });

      // Remote control (D-pad + keyboard)
      case "remoteUp":       return this.req(device, "POST", "/api/remote/up");
      case "remoteDown":     return this.req(device, "POST", "/api/remote/down");
      case "remoteLeft":     return this.req(device, "POST", "/api/remote/left");
      case "remoteRight":    return this.req(device, "POST", "/api/remote/right");
      case "remoteSelect":   return this.req(device, "POST", "/api/remote/select");
      case "remoteBack":     return this.req(device, "POST", "/api/remote/back");
      case "remoteHome":     return this.req(device, "POST", "/api/remote/home");
      case "remoteMenu":     return this.req(device, "POST", "/api/remote/menu");
      case "remotePlayPause":return this.req(device, "POST", "/api/remote/playpause");
      case "keyboardKey":    return this.req(device, "GET",  `/api/remote/keyboard/${encodeURIComponent(params?.key ?? "enter")}`);
      case "keyboardCombo":  return this.req(device, "GET",  `/api/remote/keyboard?map=${encodeURIComponent(params?.combo ?? "")}`);
      case "keyboardText":   return this.req(device, "POST", "/api/remote/text", { text: params?.text });

      // Mode switch
      case "switchMode":
        return this.req(device, "POST", "/api/mode", {
          mode: params?.mode,
          ...(params?.url     && { url:     params.url }),
          ...(params?.package && { package: params.package }),
        });

      default:
        throw new ProviderCapabilityError(PROVIDER_NAME, cmd);
    }
  }

  // ── Unsupported ────────────────────────────────────────────────────────────

  getSettings(_device: Device): Promise<Record<string, string>> {
    throw new ProviderCapabilityError(PROVIDER_NAME, "getSettings");
  }

  setSetting(_device: Device, _key: string, _value: string): Promise<void> {
    throw new ProviderCapabilityError(PROVIDER_NAME, "setSetting");
  }

  setBooleanSetting(_device: Device, _key: string, _value: boolean): Promise<void> {
    throw new ProviderCapabilityError(PROVIDER_NAME, "setBooleanSetting");
  }

  getFiles(_device: Device, _path: string): Promise<FileEntry[]> {
    throw new ProviderCapabilityError(PROVIDER_NAME, "getFiles");
  }

  getLogs(_device: Device): Promise<string> {
    throw new ProviderCapabilityError(PROVIDER_NAME, "getLogs");
  }

  getLogcat(_device: Device): Promise<string> {
    throw new ProviderCapabilityError(PROVIDER_NAME, "getLogcat");
  }
}
