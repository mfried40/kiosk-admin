/**
 * Device status history helpers.
 * Handles insert + delete-on-write pruning based on the retention window.
 */

import { db } from "./db";
import type { DeviceInfo } from "./types";

const DEFAULT_RETENTION_DAYS = 7;

async function getRetentionDays(): Promise<number> {
  const cfg = await db.appConfig.findFirst({ select: { retentionDays: true } });
  return cfg?.retentionDays ?? DEFAULT_RETENTION_DAYS;
}

/**
 * Inserts a new status snapshot for a device and prunes rows outside the
 * retention window in the same transaction.
 */
export async function recordStatus(deviceId: string, info: DeviceInfo): Promise<void> {
  const retentionDays = await getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  await db.$transaction([
    db.deviceStatusHistory.create({
      data: {
        deviceId,
        online: info.online,
        batteryLevel: info.batteryLevel ?? null,
        screenOn: info.screenOn ?? null,
        currentUrl: info.currentUrl ?? null,
      },
    }),
    db.deviceStatusHistory.deleteMany({
      where: {
        deviceId,
        recordedAt: { lt: cutoff },
      },
    }),
  ]);
}
