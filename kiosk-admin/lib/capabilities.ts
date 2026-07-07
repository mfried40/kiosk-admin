/**
 * Client-safe capabilities lookup.
 * Does NOT import Prisma or any Node.js module — safe to use in Client Components.
 */

import type { ProviderCapabilities } from "@/lib/provider.types";

const FULLY_KIOSK_CAPS: ProviderCapabilities = {
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
  hasMqttCommands: false, // Fully Kiosk MQTT is publish-only
  hasRemoteControl: false,
};

const FREE_KIOSK_CAPS: ProviderCapabilities = {
  hasScreenshot:     true,
  hasScreenControl:  true,
  hasUrlControl:     true,
  hasAppRestart:     true,
  hasKioskLock:      true,  // /api/lock (requires Device Owner or AccessibilityService)
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
  hasMqttCommands:   true,  // FreeKiosk supports commands via {baseTopic}/{id}/set/{entity}
  hasRemoteControl:  true,  // D-pad + keyboard via /api/remote/*
};

const FULLY_CLOUD_CAPS: ProviderCapabilities = {
  hasScreenshot:     false,
  hasScreenControl:  true,
  hasUrlControl:     true,
  hasAppRestart:     true,
  hasKioskLock:      true,
  hasScreensaver:    true,
  hasTTS:            true,
  hasVolume:         true,
  hasFileManagement: true,
  hasAppManagement:  true,
  hasUsageStats:     true,
  hasLogViewer:      true,
  hasCamshot:        false,
  hasMediaPlayer:    true,
  hasMaintenance:    true,
  hasTabManagement:  true,
  hasAppLauncher:    true,
  hasInjectJS:       true,
  hasFileTransfer:   true,
  hasApkManagement:  true,
  hasMqttCommands:   false,
  hasRemoteControl:  false,
};

const CAPS_MAP: Record<string, ProviderCapabilities> = {
  FULLY_KIOSK: FULLY_KIOSK_CAPS,
  FREE_KIOSK: FREE_KIOSK_CAPS,
  FULLY_CLOUD: FULLY_CLOUD_CAPS,
};

export function getCapabilitiesForProvider(provider: string): ProviderCapabilities {
  return CAPS_MAP[provider] ?? FREE_KIOSK_CAPS;
}
