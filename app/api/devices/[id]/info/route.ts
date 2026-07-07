import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, guardErrorResponse } from "@/lib/api-guard";
import { getProvider } from "@/lib/providers";
import { ProviderError, ProviderCapabilityError } from "@/lib/provider.types";
import { recordStatus } from "@/lib/history";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });

  if (!device) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const provider = getProvider(device.provider);
    const info = await provider.getDeviceInfo(device);
    // Fire-and-forget history recording (don't block the response)
    void recordStatus(device.id, info).catch(() => undefined);
    return Response.json(info);
  } catch (err) {
    // Any provider communication failure → mark offline rather than 500
    if (err instanceof ProviderError || err instanceof ProviderCapabilityError) {
      return Response.json({ online: false, lastSeen: device.updatedAt });
    }
    throw err;
  }
}
