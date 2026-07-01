import { db } from "@/lib/db";
import { requireAuth, requireRole, guardErrorResponse } from "@/lib/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAuth();
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";

  const notifications = await db.notification.findMany({
    where: unreadOnly ? { read: false } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Resolve device names in a single query
  const deviceIds = [...new Set(notifications.map((n) => n.deviceId).filter(Boolean))] as string[];
  const devices =
    deviceIds.length > 0
      ? await db.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true } })
      : [];
  const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]));

  const result = notifications.map((n) => ({
    ...n,
    device: n.deviceId ? { name: deviceMap[n.deviceId] ?? null } : null,
  }));

  const unreadCount = await db.notification.count({ where: { read: false } });

  return Response.json({ notifications: result, unreadCount });
}

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: Request): Promise<Response> {
  try {
    await requireAuth();
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { ids, all } = parsed.data;

  if (all) {
    await db.notification.updateMany({ where: { read: false }, data: { read: true } });
  } else if (ids && ids.length > 0) {
    await db.notification.updateMany({ where: { id: { in: ids } }, data: { read: true } });
  }

  return Response.json({ ok: true });
}

export async function DELETE(): Promise<Response> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }
  await db.notification.deleteMany({ where: { read: true } });
  return new Response(null, { status: 204 });
}
