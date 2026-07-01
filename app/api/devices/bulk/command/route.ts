import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { getProvider } from "@/lib/providers";
import { ProviderError } from "@/lib/provider.types";
import { writeAuditLog } from "@/lib/audit";

const BulkCommandSchema = z.object({
  cmd: z.string().min(1),
  params: z.record(z.string(), z.string()).optional(),
  deviceIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BulkCommandSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { cmd, params: cmdParams, deviceIds } = parsed.data;

  const devices = await db.device.findMany({
    where: { id: { in: deviceIds } },
  });

  if (devices.length === 0) {
    return Response.json({ error: "No matching devices" }, { status: 404 });
  }

  // All devices must share the same provider
  const providers = new Set(devices.map((d) => d.provider));
  if (providers.size > 1) {
    return Response.json(
      { error: "Bulk commands require all devices to share the same provider" },
      { status: 400 },
    );
  }

  const results = await Promise.allSettled(
    devices.map(async (device) => {
      const provider = getProvider(device.provider);
      const result = await provider.sendCommand(device, cmd, cmdParams as Record<string, string> | undefined);
      void writeAuditLog({
        userId: session!.user!.id as string,
        action: `bulk_command:${cmd}`,
        deviceId: device.id,
        payload: { cmd, params: cmdParams },
      });
      return { id: device.id, result };
    }),
  );

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  results.forEach((r, i) => {
    const device = devices[i];
    if (r.status === "fulfilled") {
      succeeded.push(device.id);
    } else {
      const err = r.reason as Error | ProviderError;
      failed.push({ id: device.id, error: err.message ?? "Unknown error" });
    }
  });

  return Response.json({ succeeded, failed });
}
