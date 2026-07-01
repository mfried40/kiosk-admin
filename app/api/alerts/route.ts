import { db } from "@/lib/db";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";
import { z } from "zod";
import type { AlertType } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await requireAuth();
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }
  const rules = await db.alertRule.findMany({ orderBy: { createdAt: "desc" } });
  const deviceIds = [...new Set(rules.map((r) => r.deviceId).filter(Boolean))] as string[];
  const devices =
    deviceIds.length > 0
      ? await db.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true } })
      : [];
  const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]));
  const result = rules.map((r) => ({ ...r, device: r.deviceId ? { name: deviceMap[r.deviceId] ?? null } : null }));
  return Response.json(result);
}

const createSchema = z.object({
  type: z.enum(["OFFLINE", "BATTERY", "UNPLUGGED"]),
  deviceId: z.string().uuid().nullable().optional(),
  threshold: z.number().min(0).max(100).nullable().optional(),
  emailEnabled: z.boolean().optional(),
  emailTo: z.string().email().nullable().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { type, deviceId, threshold, emailEnabled, emailTo, active } = parsed.data;

  if (type === "BATTERY" && (threshold === null || threshold === undefined)) {
    return Response.json({ error: "threshold is required for BATTERY alerts" }, { status: 422 });
  }

  const rule = await db.alertRule.create({
    data: {
      type: type as AlertType,
      deviceId: deviceId ?? null,
      threshold: threshold ?? null,
      emailEnabled: emailEnabled ?? false,
      emailTo: emailTo ?? null,
      active: active ?? true,
    },
  });
  const deviceName = rule.deviceId
    ? (await db.device.findUnique({ where: { id: rule.deviceId }, select: { name: true } }))?.name ?? null
    : null;
  return Response.json({ ...rule, device: rule.deviceId ? { name: deviceName } : null }, { status: 201 });
}
