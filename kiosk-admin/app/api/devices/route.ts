import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";
import { Provider } from "@/lib/generated/prisma/client";
import { removeUnknown } from "@/lib/mqtt/discovery";

const PROBE_TIMEOUT_MS = 5_000;

/** Silently probe a device to retrieve its MQTT device ID. Returns null on failure. */
async function probeForMqttDeviceId(
  ipAddress: string,
  port: number,
  password: string | undefined,
  provider: Provider,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    let res: Response;
    if (provider === "FULLY_KIOSK") {
      const url = new URL(`http://${ipAddress}:${port}/`);
      url.searchParams.set("cmd", "getDeviceInfo");
      url.searchParams.set("type", "json");
      if (password) url.searchParams.set("password", password);
      res = await fetch(url.toString(), { signal: controller.signal });
    } else {
      // FREE_KIOSK
      const headers: Record<string, string> = {};
      if (password) headers["X-Api-Key"] = password;
      res = await fetch(`http://${ipAddress}:${port}/info`, { headers, signal: controller.signal });
    }
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.status === "string" && data.status !== "OK") return null;
    return (
      typeof data.deviceId === "string" ? data.deviceId :
      typeof data.androidId === "string" ? data.androidId : null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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
  const passwordEnc = password ? encrypt(password) : "";

  // Auto-discover mqttDeviceId if not provided — probe the device silently.
  let mqttDeviceId = rest.mqttDeviceId ?? null;
  if (!mqttDeviceId && rest.provider !== "FULLY_CLOUD") {
    try {
      mqttDeviceId = await probeForMqttDeviceId(rest.ipAddress, rest.port ?? 2323, password, rest.provider);
    } catch {
      // Best-effort — device is still created without mqttDeviceId
    }
  }

  const device = await db.device.create({
    data: {
      ...rest,
      mqttDeviceId,
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

  // If this device was in the MQTT discovery queue, remove it
  if (device.mqttDeviceId) removeUnknown(device.mqttDeviceId);

  return Response.json(device, { status: 201 });
}
