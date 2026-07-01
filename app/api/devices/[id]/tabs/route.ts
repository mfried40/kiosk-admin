/**
 * POST /api/devices/[id]/tabs
 * Manage browser tabs on the device.
 *
 * Actions:
 *   focus   — bring a tab to the foreground by index
 *   close   — close a tab by index
 *   refresh — refresh the current tab
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";

type Params = { params: Promise<{ id: string }> };

const TabSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("focus"), tab: z.number().int().min(0) }),
  z.object({ action: z.literal("close"), tab: z.number().int().min(0) }),
  z.object({ action: z.literal("refresh") }),
]);

export async function POST(req: NextRequest, { params }: Params): Promise<Response> {
  try {
    await requireRole("ADMIN");
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

  const parsed = TabSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    assertCapability(device.provider, "hasTabManagement");
    const provider = getProvider(device.provider);

    let cmd: string;
    let extra: Record<string, string> = {};

    if (parsed.data.action === "focus") {
      cmd = "focusTab";
      extra = { tab: String(parsed.data.tab) };
    } else if (parsed.data.action === "close") {
      cmd = "closeTab";
      extra = { tab: String(parsed.data.tab) };
    } else {
      cmd = "refreshTab";
    }

    await provider.sendCommand(device, cmd, extra);
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
