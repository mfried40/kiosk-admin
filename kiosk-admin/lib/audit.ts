/**
 * Audit log writer.
 * Call this from API routes after a significant action.
 * Fire-and-forget — errors are swallowed so they never break the main request.
 */

import { db } from "@/lib/db";

interface AuditParams {
  userId: string;
  action: string;
  deviceId?: string;
  payload?: Record<string, unknown>;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        deviceId: params.deviceId ?? null,
        payload: params.payload ? JSON.stringify(params.payload) : null,
      },
    });
  } catch {
    // Audit failures must never break the main request flow.
  }
}
