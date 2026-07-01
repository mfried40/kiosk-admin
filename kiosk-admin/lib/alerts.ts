/**
 * Alert evaluation logic.
 * Called from MQTT handlers and polling path.
 * refs specs/007-templates-tags-alerts
 */

import nodemailer from "nodemailer";
import { db } from "./db";
import { decrypt } from "./crypto";
import type { AlertType } from "./generated/prisma/client";

// In-memory hysteresis map: deviceId -> last battery level that triggered an alert.
// Reset when battery recovers above threshold.
const batteryAlertState = new Map<string, { firedAt: number; threshold: number }>();

export type AlertEvent = "OFFLINE" | "BATTERY" | "UNPLUGGED";

async function sendAlertEmail(
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const config = await db.appConfig.findFirst({
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassEnc: true,
      alertFromEmail: true,
    },
  });

  if (!config?.smtpHost) return;

  const pass = config.smtpPassEnc ? decrypt(config.smtpPassEnc) : undefined;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort ?? 587,
    secure: (config.smtpPort ?? 587) === 465,
    auth: config.smtpUser
      ? { user: config.smtpUser, pass }
      : undefined,
  });

  await transporter.sendMail({
    from: config.alertFromEmail ?? config.smtpUser ?? "kiosk-admin@localhost",
    to,
    subject,
    text,
  });
}

/**
 * Evaluate alert rules for a device + event. Creates in-app notifications
 * and optionally sends email.
 */
export async function evaluateAlerts(
  deviceId: string,
  event: AlertEvent,
  payload?: { batteryLevel?: number },
): Promise<void> {
  // For BATTERY events, apply hysteresis
  if (event === "BATTERY" && payload?.batteryLevel !== undefined) {
    const level = payload.batteryLevel;

    // Find matching BATTERY alert rules for this device or all devices
    const rules = await db.alertRule.findMany({
      where: {
        active: true,
        type: "BATTERY" as AlertType,
        OR: [{ deviceId }, { deviceId: null }],
      },
    });

    for (const rule of rules) {
      if (rule.threshold === null) continue;
      const state = batteryAlertState.get(`${rule.id}:${deviceId}`);

      if (level < rule.threshold) {
        // Only fire if not already in alerted state for this rule+device
        if (!state) {
          batteryAlertState.set(`${rule.id}:${deviceId}`, {
            firedAt: level,
            threshold: rule.threshold,
          });
          const device = await db.device.findUnique({
            where: { id: deviceId },
            select: { name: true },
          });
          const msg = `Device "${device?.name ?? deviceId}" battery at ${level}% (below threshold ${rule.threshold}%)`;
          await db.notification.create({
            data: { deviceId, type: "BATTERY", message: msg },
          });
          if (rule.emailEnabled && rule.emailTo) {
            await sendAlertEmail(rule.emailTo, "Battery alert", msg).catch(() => undefined);
          }
        }
      } else {
        // Battery recovered above threshold — reset hysteresis
        batteryAlertState.delete(`${rule.id}:${deviceId}`);
      }
    }
    return;
  }

  // For OFFLINE and UNPLUGGED, no hysteresis — fire once per event
  const alertType = event as AlertType;
  const rules = await db.alertRule.findMany({
    where: {
      active: true,
      type: alertType,
      OR: [{ deviceId }, { deviceId: null }],
    },
  });

  if (rules.length === 0) return;

  const device = await db.device.findUnique({
    where: { id: deviceId },
    select: { name: true },
  });
  const deviceName = device?.name ?? deviceId;

  const messages: Record<AlertEvent, string> = {
    OFFLINE: `Device "${deviceName}" went offline`,
    UNPLUGGED: `Device "${deviceName}" was unplugged from power`,
    BATTERY: `Device "${deviceName}" battery low`,
  };
  const msg = messages[event];

  for (const rule of rules) {
    await db.notification.create({
      data: { deviceId, type: alertType, message: msg },
    });
    if (rule.emailEnabled && rule.emailTo) {
      await sendAlertEmail(rule.emailTo, `${event} alert`, msg).catch(() => undefined);
    }
  }
}
