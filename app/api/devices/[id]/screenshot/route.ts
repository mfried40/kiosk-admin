import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";

type Params = { params: Promise<{ id: string }> };

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
    assertCapability(device.provider, "hasScreenshot");
    const provider = getProvider(device.provider);
    const buffer = await provider.getScreenshot(device);
    return new Response(buffer as unknown as BodyInit, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ProviderCapabilityError) {
      return Response.json({ error: "Not supported" }, { status: 501 });
    }
    if (err instanceof ProviderError) {
      // 404 from device = screenshot disabled in Fully Kiosk Remote Admin settings
      if (err.status === 404) {
        return Response.json({ error: "Screenshot unavailable — enable it in the device Remote Admin settings" }, { status: 422 });
      }
      return Response.json({ error: "Device offline" }, { status: 503 });
    }
    throw err;
  }
}
