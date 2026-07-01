import { db } from "@/lib/db";
import { requireRole, guardErrorResponse } from "@/lib/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  deviceId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: Request): Promise<Response> {
  try {
    await requireRole("ADMIN");
  } catch (e) {
    return guardErrorResponse(e) ?? Response.json({ error: "Unknown" }, { status: 500 });
  }

  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 422 });
  }

  const { deviceId, userId, action, from, to, page, pageSize } = parsed.data;

  const where = {
    ...(deviceId ? { deviceId } : {}),
    ...(userId ? { userId } : {}),
    ...(action ? { action: { contains: action } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  // Resolve user emails and device names in two queries
  const userIds = [...new Set(entries.map((e) => e.userId))];
  const deviceIds = [...new Set(entries.map((e) => e.deviceId).filter(Boolean))] as string[];

  const [users, devices] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
    deviceIds.length > 0
      ? db.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.email]));
  const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]));

  const result = entries.map((e) => ({
    ...e,
    userEmail: userMap[e.userId] ?? null,
    deviceName: e.deviceId ? (deviceMap[e.deviceId] ?? null) : null,
  }));

  return Response.json({ entries: result, total, page, pageSize });
}
