import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";
import { Provider } from "@/lib/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";

const DeviceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ipAddress: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  password: z.string().min(1).optional(),
  provider: z.nativeEnum(Provider).optional(),
  mqttDeviceId: z.string().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;
  const device = await db.device.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      ipAddress: true,
      port: true,
      provider: true,
      mqttDeviceId: true,
      groupId: true,
      createdAt: true,
      updatedAt: true,
      group: { select: { id: true, name: true } },
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
  });

  if (!device) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(device);
}

export async function PUT(req: NextRequest, { params }: Params) {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;

  const existing = await db.device.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DeviceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { password, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };

  if (password !== undefined) {
    updateData["passwordEnc"] = encrypt(password);
  }

  const device = await db.device.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      ipAddress: true,
      port: true,
      provider: true,
      mqttDeviceId: true,
      groupId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  void writeAuditLog({
    userId: session.user!.id!,
    action: "updateDevice",
    deviceId: id,
    payload: { fields: Object.keys(parsed.data) },
  });

  return Response.json(device);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { id } = await params;

  const existing = await db.device.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade handled by Prisma schema (onDelete: Cascade on DeviceTag, DeviceStatusHistory)
  // AuditLog deviceId is optional so it stays.
  await db.device.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
