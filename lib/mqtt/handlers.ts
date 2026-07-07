/**
 * MQTT message handlers.
 * Subscribes to device topics and maps incoming messages to DB updates + SSE broadcasts.
 */

import type { MqttClient } from "mqtt";
import { db } from "../db";
import { broadcast } from "./sse";
import { evaluateAlerts } from "../alerts";
import { recordUnknown } from "./discovery";
import { cacheBaseTopic } from "./freekiosk-commands";

const HISTORY_LIMIT = 100; // keep last N records per device

// Status fields that can be derived from event topic names
const EVENT_STATUS_MAP: Record<string, Partial<StatusUpdate>> = {
  screenOn: { screenOn: true },
  screenOff: { screenOn: false },
  networkDisconnect: { online: false },
  networkReconnect: { online: true },
  unplugged: { pluggedIn: false },
  pluggedAC: { pluggedIn: true },
  kioskLocked: { kioskLocked: true },
  kioskUnlocked: { kioskLocked: false },
  onBatteryLevelChanged: {}, // batteryLevel parsed from payload below
};

interface StatusUpdate {
  online: boolean;
  batteryLevel?: number;
  screenOn?: boolean;
  currentUrl?: string;
  pluggedIn?: boolean;
  kioskLocked?: boolean;
}

async function updateDeviceStatus(
  mqttDeviceId: string,
  fields: Partial<StatusUpdate>,
  payloadDeviceId?: string,
  payloadIp?: string,
  payloadDeviceName?: string,
  payloadModel?: string,
): Promise<void> {
  // 1. Fast path: exact match on stored mqttDeviceId.
  let device = await db.device.findFirst({ where: { mqttDeviceId } });

  // 2. Fully Kiosk puts its own deviceId in the payload. If the admin stored a
  //    different value in mqttDeviceId, try matching by the payload's deviceId.
  if (!device && payloadDeviceId && payloadDeviceId !== mqttDeviceId) {
    device = await db.device.findFirst({ where: { mqttDeviceId: payloadDeviceId } });
  }

  // 3. Auto-discover by IP address (Fully Kiosk includes `ip4` in deviceInfo).
  //    If found, store the correct mqttDeviceId so future lookups use the fast path.
  if (!device && payloadIp) {
    device = await db.device.findFirst({ where: { ipAddress: payloadIp } });
    if (device) {
      const correctId = payloadDeviceId ?? mqttDeviceId;
      await db.device.update({
        where: { id: device.id },
        data: { mqttDeviceId: correctId },
      });
    }
  }

  if (!device) {
    // Unknown device — record for discovery banner
    recordUnknown({
      mqttDeviceId,
      deviceId: payloadDeviceId ?? mqttDeviceId,
      deviceName: payloadDeviceName,
      ipAddress: payloadIp,
      model: payloadModel,
    });
    return;
  }

  // Write a new history record
  await db.deviceStatusHistory.create({
    data: {
      deviceId: device.id,
      online: fields.online ?? true,
      batteryLevel: fields.batteryLevel ?? null,
      screenOn: fields.screenOn ?? null,
      currentUrl: fields.currentUrl ?? null,
    },
  });

  // Prune old history records beyond the limit
  const oldest = await db.deviceStatusHistory.findMany({
    where: { deviceId: device.id },
    orderBy: { recordedAt: "desc" },
    skip: HISTORY_LIMIT,
    select: { id: true },
  });
  if (oldest.length > 0) {
    await db.deviceStatusHistory.deleteMany({
      where: { id: { in: oldest.map((r) => r.id) } },
    });
  }

  // Broadcast to all SSE clients
  broadcast("device-update", { deviceId: device.id, ...fields });

  // Evaluate alert rules
  if (fields.online === false) {
    void evaluateAlerts(device.id, "OFFLINE").catch(() => undefined);
  }
  if (fields.pluggedIn === false) {
    void evaluateAlerts(device.id, "UNPLUGGED").catch(() => undefined);
  }
  if (fields.batteryLevel !== undefined) {
    void evaluateAlerts(device.id, "BATTERY", { batteryLevel: fields.batteryLevel }).catch(() => undefined);
  }
}

export function handleDeviceInfo(
  mqttDeviceId: string,
  payload: Buffer,
): void {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payload.toString()) as Record<string, unknown>;
  } catch {
    return;
  }

  // Fully Kiosk includes its own deviceId and ip4 in the payload.
  const payloadDeviceId = typeof data.deviceId === "string" ? data.deviceId : undefined;
  const payloadIp = typeof data.ip4 === "string" ? data.ip4 : undefined;
  const payloadDeviceName = typeof data.deviceName === "string" ? data.deviceName : undefined;
  const payloadModel = typeof data.model === "string" ? data.model : undefined;

  const fields: Partial<StatusUpdate> = {
    online: true,
  };
  if (typeof data.batteryLevel === "number") fields.batteryLevel = data.batteryLevel;
  if (typeof data.screenOn === "boolean") fields.screenOn = data.screenOn;
  if (typeof data.currentPageUrl === "string") fields.currentUrl = data.currentPageUrl;
  else if (typeof data.currentPage === "string") fields.currentUrl = data.currentPage;

  void updateDeviceStatus(mqttDeviceId, fields, payloadDeviceId, payloadIp, payloadDeviceName, payloadModel);
}

export function handleEvent(
  eventName: string,
  mqttDeviceId: string,
  payload: Buffer,
): void {
  const base = EVENT_STATUS_MAP[eventName];
  if (!base) return;

  const fields: Partial<StatusUpdate> = { ...base };

  // onBatteryLevelChanged carries a numeric value in the payload
  if (eventName === "onBatteryLevelChanged") {
    try {
      const data = JSON.parse(payload.toString()) as Record<string, unknown>;
      if (typeof data.batteryLevel === "number") {
        fields.batteryLevel = data.batteryLevel;
      }
    } catch {
      // ignore parse errors
    }
  }

  void updateDeviceStatus(mqttDeviceId, fields, undefined, undefined);
}

/**
 * Handle FreeKiosk state messages.
 * Topic: {prefix}/{mqttDeviceId}/state
 * Payload: { battery: { level, charging }, screen: { on }, webview: { currentUrl }, device: { ip, model, ... } }
 */
export function handleFreeKioskState(
  baseTopic: string,
  mqttDeviceId: string,
  payload: Buffer,
): void {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payload.toString()) as Record<string, unknown>;
  } catch {
    return;
  }

  // Cache the baseTopic so commands can be routed back to this device
  cacheBaseTopic(mqttDeviceId, baseTopic);

  const battery = data.battery as Record<string, unknown> | undefined;
  const screen = data.screen as Record<string, unknown> | undefined;
  const webview = data.webview as Record<string, unknown> | undefined;
  const device = data.device as Record<string, unknown> | undefined;

  const fields: Partial<StatusUpdate> = { online: true };
  if (typeof battery?.level === "number") fields.batteryLevel = battery.level;
  if (typeof screen?.on === "boolean") fields.screenOn = screen.on;
  if (typeof webview?.currentUrl === "string") fields.currentUrl = webview.currentUrl;
  if (battery?.charging !== undefined) fields.pluggedIn = Boolean(battery.charging);

  const payloadIp =
    typeof device?.ip === "string" ? device.ip :
    typeof (data.wifi as Record<string, unknown> | undefined)?.ipAddress === "string"
      ? String((data.wifi as Record<string, unknown>).ipAddress)
      : undefined;
  const payloadModel = typeof device?.model === "string" ? device.model : undefined;
  const payloadDeviceName = typeof device?.deviceName === "string" ? device.deviceName : undefined;

  void updateDeviceStatus(mqttDeviceId, fields, undefined, payloadIp, payloadDeviceName, payloadModel);
}

/**
 * Handle FreeKiosk availability messages.
 * Topic: {prefix}/{mqttDeviceId}/availability
 * Payload: "online" | "offline"
 */
export function handleFreeKioskAvailability(
  mqttDeviceId: string,
  payload: Buffer,
): void {
  const status = payload.toString().trim().toLowerCase();
  if (status !== "online" && status !== "offline") return;
  void updateDeviceStatus(mqttDeviceId, { online: status === "online" });
}

export function registerHandlers(mqttClient: MqttClient, prefix: string): void {
  // Fully Kiosk topics
  mqttClient.subscribe(`${prefix}/deviceInfo/+`, (err) => {
    if (err) console.error(`[MQTT] Subscribe error for ${prefix}/deviceInfo/+:`, err);
    else console.log(`[MQTT] Subscribed to ${prefix}/deviceInfo/+`);
  });
  mqttClient.subscribe(`${prefix}/event/+/+`, (err) => {
    if (err) console.error(`[MQTT] Subscribe error for ${prefix}/event/+/+:`, err);
    else console.log(`[MQTT] Subscribed to ${prefix}/event/+/+`);
  });
  // FreeKiosk topics: {any-prefix}/{deviceId}/state and /availability
  mqttClient.subscribe("+/+/state", (err) => {
    if (err) console.error("[MQTT] Subscribe error for +/+/state:", err);
    else console.log("[MQTT] Subscribed to +/+/state (FreeKiosk)");
  });
  mqttClient.subscribe("+/+/availability", (err) => {
    if (err) console.error("[MQTT] Subscribe error for +/+/availability:", err);
    else console.log("[MQTT] Subscribed to +/+/availability (FreeKiosk)");
  });

  mqttClient.on("message", (topic: string, payload: Buffer) => {
    console.log(`[MQTT] ← ${topic} (${payload.length}b)`);
    const segments = topic.split("/");

    if (segments.length === 3 && segments[1] === "deviceInfo") {
      // Fully Kiosk: {prefix}/deviceInfo/{deviceId}
      handleDeviceInfo(segments[2], payload);
    } else if (segments.length === 4 && segments[1] === "event") {
      // Fully Kiosk: {prefix}/event/{eventName}/{deviceId}
      handleEvent(segments[2], segments[3], payload);
    } else if (segments.length === 3 && segments[2] === "state") {
      // FreeKiosk: {baseTopic}/{deviceId}/state
      handleFreeKioskState(segments[0], segments[1], payload);
    } else if (segments.length === 3 && segments[2] === "availability") {
      // FreeKiosk: {baseTopic}/{deviceId}/availability
      handleFreeKioskAvailability(segments[1], payload);
    } else {
      console.log(`[MQTT] ← unmatched topic pattern: ${topic}`);
    }
  });
}
