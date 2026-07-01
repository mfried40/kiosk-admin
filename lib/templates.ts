/**
 * Config template application logic.
 * refs specs/007-templates-tags-alerts
 */

import { db } from "./db";
import { getProvider } from "./providers";

export interface ApplyResult {
  deviceId: string;
  success: boolean;
  error?: string;
}

export async function applyTemplate(
  templateId: string,
  deviceIds: string[],
  actorId: string,
): Promise<ApplyResult[]> {
  const template = await db.configTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  const devices = await db.device.findMany({ where: { id: { in: deviceIds } } });

  const wrongProvider = devices.filter((d) => d.provider !== template.provider);
  if (wrongProvider.length > 0) {
    throw new Error("Provider mismatch");
  }

  const settings = JSON.parse(template.settings) as Record<string, string | number | boolean | null>;
  const settingCount = Object.keys(settings).length;

  const results = await Promise.allSettled(
    devices.map(async (device): Promise<ApplyResult> => {
      try {
        const provider = getProvider(device.provider);
        for (const [key, value] of Object.entries(settings)) {
          await provider.setSetting(device, key, value === null ? "" : String(value));
        }
        await db.auditLog.create({
          data: {
            userId: actorId,
            deviceId: device.id,
            action: "TEMPLATE_APPLIED",
            payload: JSON.stringify({ templateName: template.name, settingCount }),
          },
        });
        return { deviceId: device.id, success: true };
      } catch (err) {
        return {
          deviceId: device.id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }),
  );

  return results.map((r) =>
    r.status === "fulfilled" ? r.value : { deviceId: "", success: false, error: "Unexpected" },
  );
}
