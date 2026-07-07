/**
 * Fully Cloud provider.
 *
 * Routes all commands and status reads through the Fully Cloud REST API:
 *   https://api.fully-kiosk.com
 *
 * Field mapping (reuses existing Device columns):
 *   device.ipAddress   → Fully Cloud account email (apiemail)
 *   device.passwordEnc → Encrypted API key (apikey)
 *   device.mqttDeviceId → Fully Cloud device ID (devid)
 *
 * refs specs/014-fully-cloud-provider
 */

import { decrypt } from "@/lib/crypto";
import {
  BaseKioskProvider,
  ProviderCapabilities,
  ProviderCapabilityError,
  ProviderError,
} from "@/lib/provider.types";
import type { DeviceInfo } from "@/lib/types";
import type { Device } from "@/lib/generated/prisma/client";
import { withRateLimit, RateLimitError, CLOUD_TIMEOUT_MS } from "./cloud-rate-limiter";

const CLOUD_BASE = "https://api.fully-kiosk.com";

export class FullyCloudProvider extends BaseKioskProvider {
  static override readonly capabilities: ProviderCapabilities = {
    hasScreenshot: false,      // not available via cloud API
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
    hasCamshot: false,         // not available via cloud API
    hasMediaPlayer: true,
    hasMaintenance: true,
    hasTabManagement: true,
    hasAppLauncher: true,
    hasInjectJS: true,
    hasFileTransfer: true,
    hasApkManagement: true,
    hasMqttCommands: false,
    hasRemoteControl: false,
  };

  // ── Credential helpers ──────────────────────────────────────────────────────

  private email(device: Device): string {
    return device.ipAddress; // repurposed field
  }

  private apiKey(device: Device): string {
    return decrypt(device.passwordEnc ?? "");
  }

  private devId(device: Device): string {
    return device.mqttDeviceId ?? "";
  }

  private buildUrl(
    path: string,
    device: Device,
    extra?: Record<string, string>,
  ): string {
    const u = new URL(`${CLOUD_BASE}/${path}`);
    u.searchParams.set("apiemail", this.email(device));
    u.searchParams.set("apikey", this.apiKey(device));
    u.searchParams.set("devid", this.devId(device));
    if (extra) {
      for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    }
    return u.toString();
  }

  private async cloudFetch(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 429) throw new RateLimitError();
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Provider interface ──────────────────────────────────────────────────────

  async getDeviceInfo(device: Device): Promise<DeviceInfo> {
    return withRateLimit(async () => {
      const url = this.buildUrl("cloud/devices", device);
      const res = await this.cloudFetch(url);
      if (!res.ok) {
        throw new ProviderError(res.status, `Fully Cloud returned ${res.status}`);
      }
      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch {
        throw new ProviderError(502, "Non-JSON response from Fully Cloud");
      }

      // Handle error object
      if (data && !Array.isArray(data) && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (obj.status === "Error") throw new ProviderError(502, String(obj.statustext ?? "Fully Cloud error"));
        if (Array.isArray(obj.devices)) data = obj.devices;
      }

      if (!Array.isArray(data) || data.length === 0) {
        return { online: false };
      }

      const d = (data as Record<string, unknown>[])[0];
      // Fully Cloud nests device state in lastHeartbeatInfo
      const hb = (d.lastHeartbeatInfo ?? d) as Record<string, unknown>;

      return {
        online: true,
        batteryLevel:
          typeof hb.batteryLevel === "number" ? hb.batteryLevel : undefined,
        screenOn:
          typeof hb.screenOn === "boolean" ? hb.screenOn : undefined,
        currentUrl:
          typeof hb.currentPageUrl === "string" ? hb.currentPageUrl :
          typeof hb.currentPage === "string" ? hb.currentPage : undefined,
        deviceModel:
          typeof hb.model === "string" ? hb.model :
          typeof hb.deviceModel === "string" ? hb.deviceModel : undefined,
        androidVersion:
          typeof hb.androidVersion === "string" ? hb.androidVersion : undefined,
        appVersion:
          typeof hb.version === "string" ? hb.version :
          typeof hb.appVersionName === "string" ? hb.appVersionName : undefined,
      };
    });
  }

  async getScreenshot(_device: Device): Promise<Buffer> {
    throw new ProviderCapabilityError("FullyCloud", "getScreenshot");
  }

  async getCamshot(_device: Device): Promise<Buffer> {
    throw new ProviderCapabilityError("FullyCloud", "getCamshot");
  }

  async getLogcat(_device: Device): Promise<string> {
    throw new ProviderCapabilityError("FullyCloud", "getLogcat");
  }

  async sendCommand(
    device: Device,
    cmd: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    return withRateLimit(async () => {
      const url = this.buildUrl("remote/", device, {
        cmd,
        persistent: "1",
        ...params,
      });
      const res = await this.cloudFetch(url);
      if (!res.ok) {
        throw new ProviderError(res.status, `Fully Cloud returned ${res.status}`);
      }

      const text = await res.text();
      // Response is one JSON object per line; grab the first
      const firstLine = text.trim().split("\n")[0];
      try {
        const json = JSON.parse(firstLine) as Record<string, unknown>;
        if (json.status === "Error") {
          throw new ProviderError(502, String(json.statustext ?? "Command failed"));
        }
        return json;
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        return text; // non-JSON response (e.g. base64 binary)
      }
    });
  }

  async flushQueue(device: Device): Promise<void> {
    await withRateLimit(async () => {
      const url = this.buildUrl("cloud/removeDeviceActions", device);
      const res = await this.cloudFetch(url);
      if (!res.ok) {
        throw new ProviderError(res.status, `Flush queue failed: ${res.status}`);
      }
    });
  }

  async getSettings(_device: Device): Promise<Record<string, string>> {
    throw new ProviderCapabilityError("FullyCloud", "getSettings");
  }

  async setSetting(_device: Device, _key: string, _value: string): Promise<void> {
    throw new ProviderCapabilityError("FullyCloud", "setSetting");
  }

  async setBooleanSetting(
    _device: Device,
    _key: string,
    _value: boolean,
  ): Promise<void> {
    throw new ProviderCapabilityError("FullyCloud", "setBooleanSetting");
  }

  async getFiles(_device: Device, _path: string): Promise<import("@/lib/provider.types").FileEntry[]> {
    throw new ProviderCapabilityError("FullyCloud", "getFiles");
  }

  async getLogs(_device: Device): Promise<string> {
    throw new ProviderCapabilityError("FullyCloud", "getLogs");
  }
}
