/**
 * POST /api/devices/[id]/loadzip
 * Downloads a ZIP archive from a URL and extracts it on the device.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { getProvider, assertCapability } from "@/lib/providers";
import { ProviderCapabilityError, ProviderError } from "@/lib/provider.types";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const LoadZipSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  /** Target directory on the device. Defaults to the device root if omitted. */
  dir: z.string().optional(),
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

  const parsed = LoadZipSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    assertCapability(device.provider, "hasFileTransfer");
    const provider = getProvider(device.provider);

    const extra: Record<string, string> = { url: parsed.data.url };
    if (parsed.data.dir !== undefined) extra["dir"] = parsed.data.dir;

    await provider.sendCommand(device, "loadZipFile", extra);

    writeAuditLog({
      userId: session.user!.id!,
      action: "loadZipFile",
      deviceId: id,
      payload: { url: parsed.data.url, dir: parsed.data.dir ?? "" },
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
