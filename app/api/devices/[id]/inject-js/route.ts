/**
 * POST /api/devices/[id]/inject-js
 * Injects JavaScript into the currently loaded web page on the device.
 * Requires Fully Kiosk Browser 1.60+.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const InjectSchema = z.object({
  code: z.string().min(1, "JavaScript code is required"),
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

  const parsed = InjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    assertCapability(device.provider, "hasInjectJS");
    const provider = getProvider(device.provider);
    const result = await provider.sendCommand(device, "injectJavascript", {
      code: parsed.data.code,
    });

    writeAuditLog({
      userId: session.user!.id!,
      action: "injectJavascript",
      deviceId: id,
      payload: { codeLength: String(parsed.data.code.length) },
    });

    return Response.json({ ok: true, result });
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
