import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  threshold: z.number().min(0).max(100).nullable().optional(),
  emailEnabled: z.boolean().optional(),
  emailTo: z.string().email().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const existing = await db.alertRule.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const updated = await db.alertRule.update({
    where: { id },
    data: parsed.data,
  });
  const deviceName = updated.deviceId
    ? (await db.device.findUnique({ where: { id: updated.deviceId }, select: { name: true } }))?.name ?? null
    : null;
  return Response.json({ ...updated, device: updated.deviceId ? { name: deviceName } : null });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  const { id } = await params;
  const existing = await db.alertRule.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await db.alertRule.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
