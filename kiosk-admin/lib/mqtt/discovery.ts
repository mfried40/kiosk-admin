/**
 * In-memory store for MQTT devices that are broadcasting but not yet registered.
 * Cleared on server restart — devices republish automatically so persistence isn't needed.
 */
import { broadcast } from "./sse";

export interface UnknownDevice {
  mqttDeviceId: string; // from topic segment
  deviceId: string;     // from payload (Fully Kiosk includes it there too)
  deviceName?: string;
  ipAddress?: string;
  model?: string;
  seenAt: Date;
}

/** Active unknown device entries keyed by mqttDeviceId. */
const store = new Map<string, UnknownDevice>();

/** mqttDeviceIds dismissed for the lifetime of this server process. */
const dismissed = new Set<string>();

export function isDismissed(mqttDeviceId: string): boolean {
  return dismissed.has(mqttDeviceId);
}

export function listUnknown(): UnknownDevice[] {
  return Array.from(store.values()).sort(
    (a, b) => b.seenAt.getTime() - a.seenAt.getTime(),
  );
}

export function recordUnknown(
  entry: Omit<UnknownDevice, "seenAt">,
): void {
  if (dismissed.has(entry.mqttDeviceId)) return;

  const existing = store.get(entry.mqttDeviceId);
  const updated: UnknownDevice = {
    ...existing,
    ...entry,
    seenAt: existing?.seenAt ?? new Date(),
  };
  store.set(entry.mqttDeviceId, updated);

  broadcast("unknown-device", updated);
}

export function dismiss(mqttDeviceId: string): void {
  store.delete(mqttDeviceId);
  dismissed.add(mqttDeviceId);
  broadcast("unknown-device-dismissed", { mqttDeviceId });
}

/** Remove from store when a device gets successfully added to the DB. */
export function removeUnknown(mqttDeviceId: string): void {
  store.delete(mqttDeviceId);
  broadcast("unknown-device-dismissed", { mqttDeviceId });
}
