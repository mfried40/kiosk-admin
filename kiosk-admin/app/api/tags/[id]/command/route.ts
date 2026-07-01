import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { writeAuditLog } from "@/lib/audit";
import { getProvider } from "@/lib/providers";
import { z } from "zod";

const bodySchema = z.object({
  cmd: z.string().min(1),
  params: z.record(z.string(), z.string()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  const { id } = await params;

  const tag = await db.tag.findUnique({ where: { id }, include: { devices: { include: { device: true } } } });
  if (!tag) return Response.json({ error: "Tag not found" }, { status: 404 });

  const devices = tag.devices.map((dt) => dt.device);
  if (devices.length === 0) return Response.json({ error: "No devices in this tag" }, { status: 400 });

  // Validate provider homogeneity
  const providers = [...new Set(devices.map((d) => d.provider))];
  if (providers.length > 1) {
    return Response.json({ error: "All devices in the tag must use the same provider" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { cmd, params: cmdParams } = parsed.data;

  const results = await Promise.allSettled(
    devices.map(async (device) => {
      const provider = getProvider(device.provider);
      await provider.sendCommand(device, cmd, cmdParams);
      void writeAuditLog({
        userId: session.user!.id!,
        action: "sendCommand",
        deviceId: device.id,
        payload: { cmd, params: cmdParams, via: "tag", tagId: id, tagName: tag.name },
      });
    }),
  );

  const succeeded = results
    .map((r, i) => ({ id: devices[i]!.id, ok: r.status === "fulfilled" }))
    .filter((r) => r.ok)
    .map((r) => r.id);
  const failed = results
    .map((r, i) => ({
      id: devices[i]!.id,
      error: r.status === "rejected" ? String((r as PromiseRejectedResult).reason) : "",
    }))
    .filter((_, i) => results[i]!.status === "rejected");

  return Response.json({ succeeded, failed });
}
