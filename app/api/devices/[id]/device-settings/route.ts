/**
 * GET  /api/devices/[id]/device-settings  — list all Fully Kiosk settings on the device
 * PUT  /api/devices/[id]/device-settings  — set a single setting (string or boolean)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, requireAuth, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const UpdateSettingSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("string"), key: z.string().min(1), value: z.string() }),
  z.object({ type: z.literal("boolean"), key: z.string().min(1), value: z.boolean() }),
]);

export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    assertCapability(device.provider, "hasAppManagement");
    const provider = getProvider(device.provider);
    const settings = await provider.getSettings(device);
    return Response.json(settings);
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

export async function PUT(req: NextRequest, { params }: Params): Promise<Response> {
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

  const parsed = UpdateSettingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    assertCapability(device.provider, "hasAppManagement");
    const provider = getProvider(device.provider);
    const { key, value, type } = parsed.data;

    if (type === "boolean") {
      await provider.setBooleanSetting(device, key, value);
    } else {
      await provider.setSetting(device, key, value);
    }

    writeAuditLog({
      userId: session.user!.id!,
      action: "updateDeviceSetting",
      deviceId: id,
      payload: { key, value: String(value), type },
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
