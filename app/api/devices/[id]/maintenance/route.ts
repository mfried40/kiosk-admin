/**
 * POST /api/devices/[id]/maintenance
 * Enable or disable maintenance (locked) mode on the device.
 *
 * Body: { "action": "enable" | "disable" }
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const MaintenanceSchema = z.object({
  action: z.enum(["enable", "disable"]),
});

export async function POST(req: NextRequest, { params }: Params): Promise<Response> {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return Response.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MaintenanceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const cmd = parsed.data.action === "enable" ? "enableLockedMode" : "disableLockedMode";

  try {
    assertCapability(device.provider, "hasMaintenance");
    const provider = getProvider(device.provider);
    await provider.sendCommand(device, cmd);

    writeAuditLog({
      userId: session.user!.id!,
      action: cmd,
      deviceId: id,
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ProviderCapabilityError) {
      return Response.json({ error: "Not supported" }, { status: 501 });
    }
    if (err instanceof ProviderError) {
      return Response.json({ error: "Device offline" }, { status: 503 });
    }
    throw err;
  }
}
