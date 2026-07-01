/**
 * Fully Kiosk Browser provider implementation.
 *
 * Communicates with the Fully Kiosk Browser REST API:
 *   http://{ipAddress}:{port}/?cmd={cmd}&password={password}&{...params}
 *
 * All capabilities are supported.
 */

import { decrypt } from "@/lib/crypto";
import {
  BaseKioskProvider,
  ProviderCapabilities,
  ProviderError,
  FileEntry,
} from "@/lib/provider.types";
import type { DeviceInfo } from "@/lib/types";
import type { Device } from "@/lib/generated/prisma/client";

const TIMEOUT_MS = 5_000;

export class FullyKioskProvider extends BaseKioskProvider {
  static override readonly capabilities: ProviderCapabilities = {
    hasScreenshot: true,
    hasScreenControl: true,
    hasUrlControl: true,
    hasAppRestart: true,
    hasKioskLock: true,
    hasScreensaver: true,
    hasTTS: true,
    hasVolume: true,
    hasFileManagement: true,
    hasAppManagement: true,
    hasUsageStats: true,
    hasLogViewer: true,
    hasCamshot: true,
    hasMediaPlayer: true,
    hasMaintenance: true,
    hasTabManagement: true,
    hasAppLauncher: true,
    hasInjectJS: true,
    hasFileTransfer: true,
    hasApkManagement: true,
  };

  private baseUrl(device: Device): string {
    return `http://${device.ipAddress}:${device.port}`;
  }

  private password(device: Device): string {
    return decrypt(device.passwordEnc ?? "");
  }

  private async fetch(
    device: Device,
    cmd: string,
    extra?: Record<string, string>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const url = new URL("/", this.baseUrl(device));
    url.searchParams.set("cmd", cmd);
    url.searchParams.set("password", this.password(device));
    url.searchParams.set("type", "json");
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        url.searchParams.set(k, v);
      }
    }

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        throw new ProviderError(res.status, `Fully Kiosk returned ${res.status}`);
      }
      return res;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // AbortError or network error
      throw new ProviderError(503, "Device unreachable");
    } finally {
      clearTimeout(timer);
    }
  }

  async getDeviceInfo(device: Device): Promise<DeviceInfo> {
    const res = await this.fetch(device, "deviceInfo");
    const data = (await res.json()) as Record<string, unknown>;

    return {
      online: true,
      batteryLevel:
        typeof data["batteryLevel"] === "number" ? data["batteryLevel"] : undefined,
      screenOn:
        typeof data["screenOn"] === "boolean" ? data["screenOn"] : undefined,
      currentUrl:
        typeof data["currentPage"] === "string" ? data["currentPage"] : undefined,
      deviceModel:
        typeof data["deviceModel"] === "string" ? data["deviceModel"] : undefined,
      androidVersion:
        typeof data["androidVersion"] === "string" ? data["androidVersion"] : undefined,
      appVersion:
        typeof data["appVersionName"] === "string" ? data["appVersionName"] : undefined,
      storageTotal:
        typeof data["totalInternalStorage"] === "number"
          ? data["totalInternalStorage"]
          : undefined,
      storageFree:
        typeof data["freeInternalStorage"] === "number"
          ? data["freeInternalStorage"]
          : undefined,
      brightness:
        typeof data["screenBrightness"] === "number"
          ? data["screenBrightness"]
          : undefined,
      volume:
        typeof data["soundVolume"] === "number" ? data["soundVolume"] : undefined,
    };
  }

  async getScreenshot(device: Device): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const url = new URL("/", this.baseUrl(device));
    url.searchParams.set("cmd", "getScreenshot");
    url.searchParams.set("password", this.password(device));

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        throw new ProviderError(res.status, `Screenshot failed: ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      return Buffer.from(buf);
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(503, "Device unreachable");
    } finally {
      clearTimeout(timer);
    }
  }

  async sendCommand(
    device: Device,
    cmd: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    const res = await this.fetch(device, cmd, params);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async getSettings(device: Device): Promise<Record<string, string>> {
    const res = await this.fetch(device, "listSettings");
    return (await res.json()) as Record<string, string>;
  }

  async setSetting(device: Device, key: string, value: string): Promise<void> {
    await this.fetch(device, "setStringSetting", { key, value });
  }

  async getFiles(device: Device, path: string): Promise<FileEntry[]> {
    const res = await this.fetch(device, "listFiles", { path });
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data.map((f: Record<string, unknown>) => ({
      name: String(f["name"] ?? ""),
      path: String(f["path"] ?? ""),
      isDirectory: Boolean(f["isDirectory"]),
      size: typeof f["size"] === "number" ? f["size"] : undefined,
      modified: typeof f["modified"] === "string" ? f["modified"] : undefined,
    }));
  }

  async getLogs(device: Device): Promise<string> {
    const res = await this.fetch(device, "showLog");
    return res.text();
  }

  async getCamshot(device: Device): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const url = new URL("/", this.baseUrl(device));
    url.searchParams.set("cmd", "getCamshot");
    url.searchParams.set("password", this.password(device));

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        throw new ProviderError(res.status, `Camshot failed: ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      return Buffer.from(buf);
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(503, "Device unreachable");
    } finally {
      clearTimeout(timer);
    }
  }

  async getLogcat(device: Device): Promise<string> {
    const res = await this.fetch(device, "logcat");
    return res.text();
  }

  async setBooleanSetting(device: Device, key: string, value: boolean): Promise<void> {
    await this.fetch(device, "setBooleanSetting", { key, value: String(value) });
  }
}
