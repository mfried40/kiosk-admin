/**
 * Provider abstraction types.
 * Shared by all KioskProvider implementations and API routes.
 * This file must NOT import from @/lib/generated/prisma/client at runtime
 * so that client components can safely import from here.
 */

import type { Device } from "@/lib/generated/prisma/client";

// Re-export DeviceInfo from types to avoid circular imports
export type { DeviceInfo } from "@/lib/types";

/**
 * Mirror of the Prisma Provider enum — keep in sync with prisma/schema.prisma.
 * Defined here (not imported from Prisma) so client components can use it
 * without pulling the Prisma runtime into the browser bundle.
 */
export const Provider = {
  FULLY_KIOSK: "FULLY_KIOSK",
  FREE_KIOSK: "FREE_KIOSK",
  FULLY_CLOUD: "FULLY_CLOUD",
} as const;
export type Provider = (typeof Provider)[keyof typeof Provider];

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
}

export interface ProviderCapabilities {
  hasScreenshot: boolean;
  hasScreenControl: boolean;
  hasUrlControl: boolean;
  hasAppRestart: boolean;
  hasKioskLock: boolean;
  hasScreensaver: boolean;
  hasTTS: boolean;
  hasVolume: boolean;
  hasFileManagement: boolean;
  hasAppManagement: boolean;
  hasUsageStats: boolean;
  hasLogViewer: boolean;
  hasCamshot: boolean;
  /** Play / stop audio and video files */
  hasMediaPlayer: boolean;
  /** Enable / disable maintenance (locked) mode and overlay messages */
  hasMaintenance: boolean;
  /** Focus, close, and refresh browser tabs */
  hasTabManagement: boolean;
  /** Launch arbitrary apps / intents and bring them to/from foreground */
  hasAppLauncher: boolean;
  /** Inject JavaScript into the current web page */
  hasInjectJS: boolean;
  /** Download and unpack ZIP archives on the device */
  hasFileTransfer: boolean;
  /** Install and uninstall APKs */
  hasApkManagement: boolean;
  /** Route commands through MQTT broker instead of direct HTTP (device must subscribe to cmd topic) */
  hasMqttCommands: boolean;
}

import type { DeviceInfo } from "@/lib/types";

export interface KioskProvider {
  getDeviceInfo(device: Device): Promise<DeviceInfo>;
  getScreenshot(device: Device): Promise<Buffer>;
  getCamshot(device: Device): Promise<Buffer>;
  getLogcat(device: Device): Promise<string>;
  sendCommand(
    device: Device,
    cmd: string,
    params?: Record<string, string>,
  ): Promise<unknown>;
  getSettings(device: Device): Promise<Record<string, string>>;
  setSetting(device: Device, key: string, value: string): Promise<void>;
  setBooleanSetting(device: Device, key: string, value: boolean): Promise<void>;
  getFiles(device: Device, path: string): Promise<FileEntry[]>;
  getLogs(device: Device): Promise<string>;
}

export abstract class BaseKioskProvider implements KioskProvider {
  static readonly capabilities: ProviderCapabilities;
  abstract getDeviceInfo(device: Device): Promise<DeviceInfo>;
  abstract getScreenshot(device: Device): Promise<Buffer>;
  abstract getCamshot(device: Device): Promise<Buffer>;
  abstract getLogcat(device: Device): Promise<string>;
  abstract sendCommand(
    device: Device,
    cmd: string,
    params?: Record<string, string>,
  ): Promise<unknown>;
  abstract getSettings(device: Device): Promise<Record<string, string>>;
  abstract setSetting(device: Device, key: string, value: string): Promise<void>;
  abstract setBooleanSetting(device: Device, key: string, value: boolean): Promise<void>;
  abstract getFiles(device: Device, path: string): Promise<FileEntry[]>;
  abstract getLogs(device: Device): Promise<string>;
}

export class ProviderCapabilityError extends Error {
  constructor(provider: string, capability: string) {
    super(`${provider} does not support ${capability}`);
    this.name = "ProviderCapabilityError";
  }
}

export class ProviderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
