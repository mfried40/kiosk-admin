/**
 * MQTT message handlers.
 * Subscribes to device topics and maps incoming messages to DB updates + SSE broadcasts.
 */

import type { MqttClient } from "mqtt";
import { db } from "../db";
import { broadcast } from "./sse";
import { evaluateAlerts } from "../alerts";

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

  if (!device) return;

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

  const fields: Partial<StatusUpdate> = {
    online: true,
  };
  if (typeof data.batteryLevel === "number") fields.batteryLevel = data.batteryLevel;
  if (typeof data.screenOn === "boolean") fields.screenOn = data.screenOn;
  if (typeof data.currentPageUrl === "string") fields.currentUrl = data.currentPageUrl;
  else if (typeof data.currentPage === "string") fields.currentUrl = data.currentPage;

  void updateDeviceStatus(mqttDeviceId, fields, payloadDeviceId, payloadIp);
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

export function registerHandlers(mqttClient: MqttClient, prefix: string): void {
  // Subscribe to both topic patterns
  mqttClient.subscribe(`${prefix}/deviceinfo/+`);
  mqttClient.subscribe(`${prefix}/event/+/+`);

  mqttClient.on("message", (topic: string, payload: Buffer) => {
    const segments = topic.split("/");

    if (segments.length === 3 && segments[1] === "deviceinfo") {
      const mqttDeviceId = segments[2];
      handleDeviceInfo(mqttDeviceId, payload);
    } else if (segments.length === 4 && segments[1] === "event") {
      const eventName = segments[2];
      const mqttDeviceId = segments[3];
      handleEvent(eventName, mqttDeviceId, payload);
    }
  });
}
