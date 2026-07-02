import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { getCapabilitiesForProvider } from "@/lib/capabilities";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";
import { writeAuditLog } from "@/lib/audit";
import { isConnected, publishCommand, getActiveConfig } from "@/lib/mqtt/client";

// Commands that require a specific capability gate
const CAPABILITY_MAP: Record<string, keyof import("@/lib/provider.types").ProviderCapabilities> = {
  // Screen control
  screenOn: "hasScreenControl",
  screenOff: "hasScreenControl",
  forceSleep: "hasScreenControl",
  // URL / web control
  loadUrl: "hasUrlControl",
  loadStartUrl: "hasUrlControl",
  refreshTab: "hasTabManagement",
  focusTab: "hasTabManagement",
  closeTab: "hasTabManagement",
  clearCache: "hasUrlControl",
  clearWebstorage: "hasUrlControl",
  clearCookies: "hasUrlControl",
  resetWebview: "hasUrlControl",
  // Screensaver / daydream
  startScreensaver: "hasScreensaver",
  stopScreensaver: "hasScreensaver",
  startDaydream: "hasScreensaver",
  stopDaydream: "hasScreensaver",
  // TTS
  textToSpeech: "hasTTS",
  stopTextToSpeech: "hasTTS",
  // Volume
  setVolume: "hasVolume",
  setAudioVolume: "hasVolume",
  // App restart
  restartApp: "hasAppRestart",
  // Kiosk lock
  lockKiosk: "hasKioskLock",
  unlockKiosk: "hasKioskLock",
  // App management
  startApplication: "hasAppLauncher",
  startIntent: "hasAppLauncher",
  toForeground: "hasAppLauncher",
  toBackground: "hasAppLauncher",
  exitApp: "hasAppLauncher",
  killMyProcess: "hasAppLauncher",
  popFragment: "hasAppLauncher",
  killBackgroundProcesses: "hasAppManagement",
  clearAppData: "hasAppManagement",
  // APK management
  loadApkFile: "hasApkManagement",
  uninstallApp: "hasApkManagement",
  getInstallApkState: "hasApkManagement",
  // Media player
  playSound: "hasMediaPlayer",
  stopSound: "hasMediaPlayer",
  playVideo: "hasMediaPlayer",
  stopVideo: "hasMediaPlayer",
  // Maintenance
  enableLockedMode: "hasMaintenance",
  disableLockedMode: "hasMaintenance",
  setOverlayMessage: "hasMaintenance",
  // JavaScript injection
  injectJavascript: "hasInjectJS",
  // File transfer
  loadZipFile: "hasFileTransfer",
  // Screenshot / camshot
  screenshot: "hasScreenshot",
};

const CommandSchema = z.object({
  cmd: z.string().min(1),
  params: z.record(z.string(), z.string()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CommandSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { cmd, params: cmdParams } = parsed.data;

  // Volume range validation
  if (cmd === "setVolume") {
    const level = Number(cmdParams?.level);
    if (!cmdParams?.level || isNaN(level) || level < 0 || level > 100) {
      return Response.json({ error: "Volume level must be 0–100" }, { status: 400 });
    }
  }

  // Capability gate
  const requiredCap = CAPABILITY_MAP[cmd];
  if (requiredCap) {
    try {
      assertCapability(device.provider, requiredCap);
    } catch (err) {
      if (err instanceof ProviderCapabilityError) {
        return Response.json({ error: err.message }, { status: 501 });
      }
      throw err;
    }
  }

  const provider = getProvider(device.provider);
  const caps = getCapabilitiesForProvider(device.provider);

  // Only route through MQTT if the provider explicitly supports it.
  // Fully Kiosk MQTT is publish-only — it does not subscribe to commands.
  if (caps.hasMqttCommands && device.mqttDeviceId && isConnected()) {
    const prefix = getActiveConfig()?.topicPrefix ?? "fully";
    const ok = publishCommand(device.mqttDeviceId, prefix, cmd, cmdParams as Record<string, string> | undefined);
    if (!ok) {
      return Response.json({ error: "MQTT publish failed — broker disconnected" }, { status: 502 });
    }

    void writeAuditLog({
      userId: session.user!.id as string,
      action: `command:${cmd}`,
      deviceId: id,
      payload: { cmd, params: cmdParams },
    });

    return Response.json({ ok: true, transport: "mqtt" });
  }

  try {
    const result = await provider.sendCommand(device, cmd, cmdParams as Record<string, string> | undefined);

    void writeAuditLog({
      userId: session.user!.id as string,
      action: `command:${cmd}`,
      deviceId: id,
      payload: { cmd, params: cmdParams },
    });

    return Response.json({ ok: true, result, transport: "http" });
  } catch (err) {
    if (err instanceof ProviderError) {
      return Response.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
