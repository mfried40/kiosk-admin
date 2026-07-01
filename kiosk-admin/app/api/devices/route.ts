import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";
import { Provider } from "@/lib/generated/prisma/client";

const DeviceCreateSchema = z.object({
  name: z.string().min(1).max(100),
  ipAddress: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(2323),
  password: z.string().optional(),
  provider: z.nativeEnum(Provider),
  mqttDeviceId: z.string().optional(),
  groupId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const groupId = searchParams.get("groupId") ?? undefined;
  const tagId = searchParams.get("tagId") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const devices = await db.device.findMany({
    where: {
      ...(groupId ? { groupId } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { ipAddress: { contains: search } },
            ],
          }
        : {}),
    },
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
    orderBy: { name: "asc" },
  });

  return Response.json(devices);
}

export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN");
  } catch (err) {
    return guardErrorResponse(err) ?? Response.json({ error: "Unknown error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DeviceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { password, tagIds, ...rest } = parsed.data;
  // passwordEnc="" is the sentinel for "no password" — Device.passwordEnc is NOT NULL in the DB
  const passwordEnc = password ? encrypt(password) : "";

  const device = await db.device.create({
    data: {
      ...rest,
      passwordEnc,
      ...(tagIds && tagIds.length > 0
        ? {
            tags: {
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
    },
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

  return Response.json(device, { status: 201 });
}
